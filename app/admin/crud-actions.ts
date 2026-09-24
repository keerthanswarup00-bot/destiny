"use server";
import sharp from "sharp";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, clientSchema, folderSchema, gallerySchema, photoUploadSchema, slugify } from "@/lib/admin-validation";
import { photoStore } from "@/lib/storage-provider";
import { auditStorageOrphans as auditOrphans, cleanupOrphanedPhotoKeys as cleanupOrphans, isClientPhotoStorageKey, photoStoragePaths } from "@/lib/storage-ops";
import { createSignedPutUrl, downloadObjectBytes } from "@/lib/r2";
import { hashGalleryPassword } from "@/lib/gallery-password";
import { validateWatermarkSettings, watermarkSourceFromBytes, watermarkedDerivative, type ActiveWatermarkConfig, type WatermarkSource } from "@/lib/watermark-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
async function db() { await requireAdmin(); return adminDb(); }
async function invalidateTags(...tags: string[]) { await Promise.all(tags.map(tag => revalidateTag(tag))); }
export async function createClient(form: FormData) { const parsed = clientSchema.safeParse({ name:value(form,"name"), event_date:value(form,"date"), phone:value(form,"phone"), notes:value(form,"notes") }); if (!parsed.success) return redirect("/admin/clients?error=invalid-client"); const supabase = await db(); const { data, error } = await supabase.from("clients").insert({ ...parsed.data, event_date: parsed.data.event_date || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null }).select("id").single(); if (error || !data) return redirect("/admin/clients?error=client-create"); redirect(`/admin/clients/${data.id}`); }
export async function updateClient(form: FormData) { const id=value(form,"id"); const parsed=clientSchema.safeParse({name:value(form,"name"),event_date:value(form,"date"),phone:value(form,"phone"),notes:value(form,"notes")}); if(!parsed.success) return redirect(`/admin/clients/${id}?error=invalid-client`); const supabase=await db(); await supabase.from("clients").update({...parsed.data,event_date:parsed.data.event_date||null,phone:parsed.data.phone||null,notes:parsed.data.notes||null}).eq("id",id); revalidatePath(`/admin/clients/${id}`); redirect(`/admin/clients/${id}`); }
export async function deleteClient(form: FormData) { const id=value(form,"id"); const supabase=await db(); const {error}=await supabase.from("clients").delete().eq("id",id); redirect(error?`/admin/clients/${id}?error=client-has-galleries`:"/admin/clients"); }
async function galleryAccessUpdate(form: FormData): Promise<{ ok: false } | { ok: true; patch: { password_hash?: string | null; client_password_hash?: string | null } }> {
  const patch: { password_hash?: string | null; client_password_hash?: string | null } = {};
  const viewerPassword = value(form, "password");
  if (value(form, "clear_password") === "on") {
    patch.password_hash = null;
  } else if (viewerPassword) {
    if (viewerPassword.trim().length < 6) return { ok: false };
    patch.password_hash = await hashGalleryPassword(viewerPassword);
  }
  const clientPassword = value(form, "client_password");
  if (value(form, "clear_client_password") === "on") {
    patch.client_password_hash = null;
  } else if (clientPassword) {
    if (clientPassword.trim().length < 6) return { ok: false };
    patch.client_password_hash = await hashGalleryPassword(clientPassword);
  }
  return { ok: true, patch };
}
export async function createGallery(form: FormData) { const clientId=value(form,"client_id"); const fromGalleries=value(form,"from")==="galleries"; const fail=(code:string)=>redirect(`${fromGalleries||!clientId?"/admin/galleries":`/admin/clients/${clientId}`}?error=${code}`); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:clientId,description:"",slug:slugify(value(form,"title")),status:"draft"}); if(!parsed.success || !parsed.data.slug) return fail("invalid-gallery"); const password=await galleryAccessUpdate(form); if(!password.ok) return fail("invalid-gallery"); const supabase=await db(); const {data,error}=await supabase.from("galleries").insert({...parsed.data,description:parsed.data.description||null,...password.patch}).select("id").single(); if(error||!data) return fail("gallery-create"); const { error: folderError } = await supabase.from("folders").insert({ gallery_id: data.id, name: "Photos", slug: "photos", sort_order: 0 }); if(folderError) { await supabase.from("galleries").delete().eq("id", data.id); return fail("gallery-create"); } redirect(`/admin/galleries/${data.id}`); }
export async function updateGallery(form: FormData) { const id=value(form,"id"); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:value(form,"client_id"),description:value(form,"description"),slug:value(form,"slug"),status:value(form,"status")||"draft"}); if(!parsed.success) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const password=await galleryAccessUpdate(form); if(!password.ok) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const supabase=await db(); await supabase.from("galleries").update({...parsed.data,description:parsed.data.description||null,...password.patch}).eq("id",id); revalidatePath(`/admin/galleries/${id}`); await invalidateTags("site-stories", "site-portfolio"); redirect(`/admin/galleries/${id}`); }
export async function deleteGallery(form: FormData) {
  const id=value(form,"id"); const supabase=await db();
  const { data: galleryPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path").eq("gallery_id",id);
  const paths=(galleryPhotos??[]).flatMap(photoStoragePaths);
  // Delete the DB rows first so a failed delete never purges storage objects
  // that are still referenced. Any storage leftovers are reclaimed by the
  // storage audit instead of becoming broken images.
  const { error }=await supabase.from("galleries").delete().eq("id",id);
  if(error) return redirect(`/admin/galleries?error=gallery-delete`);
  if(paths.length) {
    try {
      await photoStore().removePhotos(paths);
    } catch {
      return redirect(`/admin/galleries?error=gallery-storage-delete`);
    }
  }
  revalidatePath("/admin/galleries");
  await invalidateTags("site-stories", "site-portfolio");
  redirect("/admin/galleries");
}
export async function createFolder(form: FormData) { const gallery=value(form,"gallery_id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const description=value(form,"description").trim().slice(0,400)||null; const supabase=await db(); const {count}=await supabase.from("folders").select("id",{count:"exact",head:true}).eq("gallery_id",gallery); await supabase.from("folders").insert({gallery_id:gallery,name:parsed.data.name,slug,description,sort_order:count??0}); revalidatePath(`/admin/galleries/${gallery}`); }
export async function renameFolder(form: FormData) { const gallery=value(form,"gallery_id"),id=value(form,"id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const supabase=await db(); const description=value(form,"description").trim().slice(0,400)||null; await supabase.from("folders").update({name:parsed.data.name,slug,description}).eq("id",id).eq("gallery_id",gallery); revalidatePath(`/admin/galleries/${gallery}`); }
export async function deleteFolder(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const supabase=await db();
  // Deleting a folder cascades every descendant folder in the DB, so storage
  // must cover the whole subtree or nested-set photos become orphans.
  const { data: allFolders }=await supabase.from("folders").select("id,parent_folder_id").eq("gallery_id",gallery);
  const affected=new Set<string>([id]);
  let changed=true;
  while(changed){
    changed=false;
    for(const folder of allFolders ?? []){
      if(folder.parent_folder_id && affected.has(folder.parent_folder_id) && !affected.has(folder.id)){ affected.add(folder.id); changed=true; }
    }
  }
  const { data: folderPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path").eq("gallery_id",gallery).in("folder_id",[...affected]);
  const paths=(folderPhotos??[]).flatMap(photoStoragePaths);
  // DB-first so a failed delete leaves storage intact (see deleteGallery).
  const { error }=await supabase.from("folders").delete().eq("id",id).eq("gallery_id",gallery);
  if(error) return redirect(`/admin/galleries/${gallery}?error=folder-delete`);
  if(paths.length){
    try {
      await photoStore().removePhotos(paths);
    } catch {
      return redirect(`/admin/galleries/${gallery}?error=folder-storage-delete`);
    }
  }
  revalidatePath(`/admin/galleries/${gallery}`);
}
function galleryFail(gallery: string, code: string) { return redirect(`/admin/galleries/${gallery}?error=${code}`); }
function storageFilename(filename: string) { const trimmed=filename.trim().slice(0,500); const dot=trimmed.lastIndexOf("."); const ext=dot>0?trimmed.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g,""):""; return `${slugify(dot>0?trimmed.slice(0,dot):trimmed)||"photo"}${ext}`; }
const THUMBNAIL_LONG_EDGE = 640;
const PREVIEW_LONG_EDGE = 2400;
const DOWNLOAD_QUALITY = 92;
const isR2Provider = () => process.env.PHOTO_STORAGE_PROVIDER?.trim().toLowerCase() === "r2";

/* ------------------------------------------------------------------ */
/* Client Gallery watermarking                                         */
/* ------------------------------------------------------------------ */

// The active watermark is the admin-managed logo configured in Settings →
// Watermark together with its saved appearance settings. When no logo is
// configured, or the admin has disabled the watermark, uploads produce normal
// unwatermarked derivatives.
// Keyed by the stored object path so a replaced logo invalidates the cache.
const watermarkSourceCache = new Map<string, WatermarkSource>();

async function activeWatermark(supabase: SupabaseClient<Database>): Promise<ActiveWatermarkConfig | null> {
  const { data } = await supabase.from("site_branding").select("watermark_path,watermark_enabled,watermark_opacity,watermark_scale,watermark_margin,watermark_position").eq("id", "branding").maybeSingle();
  const key = (data?.watermark_path as string | null) ?? null;
  if (!key || data?.watermark_enabled === false) return null;
  const settings = validateWatermarkSettings({
    enabled: data?.watermark_enabled,
    opacity: data?.watermark_opacity,
    scale: data?.watermark_scale,
    margin: data?.watermark_margin,
    position: data?.watermark_position,
  });
  const cached = watermarkSourceCache.get(key);
  if (cached) return { source: cached, settings };
  const bytes = await photoStore().downloadBytes(key);
  if (!bytes) return null;
  const source = await watermarkSourceFromBytes(bytes, key);
  if (!source) return null;
  watermarkSourceCache.set(key, source);
  return { source, settings };
}

function withinLongEdge(width: number, height: number, longEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= longEdge) return { width, height };
  const scale = longEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Build and store the three client-facing derivatives (watermarked when a logo
 * is configured, plain otherwise). A photo with no derivatives is never made
 * visible to a client; on partial failure the created derivatives are removed
 * before the error propagates. `overwrite` allows re-stamping an existing
 * photo (keys may already exist); `keepOnFailure` lists currently-referenced
 * keys that must never be deleted by that cleanup so no failure can leave a
 * photo with broken images.
 */
async function storeWatermarkedDerivatives(
  body: Buffer,
  paths: { thumbnail: string; preview: string; download: string },
  watermark: ActiveWatermarkConfig | null,
  options?: { overwrite?: boolean; keepOnFailure?: string[] },
): Promise<{ width: number | null; height: number | null; uploaded: string[] }> {
  const metadata = await sharp(body).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("derivative-missing-dimensions");
  // Display derivatives stay WebP for fast loading; the client-download
  // derivative is a full-resolution JPEG. Each job's contentType is the exact
  // MIME of the stored bytes (not a rename of the WebP file).
  const jobs: { key: string; size: { width: number; height: number }; quality: number; contentType: "image/webp" | "image/jpeg" }[] = [
    { key: paths.thumbnail, size: withinLongEdge(width, height, THUMBNAIL_LONG_EDGE), quality: 80, contentType: "image/webp" },
    { key: paths.preview, size: withinLongEdge(width, height, PREVIEW_LONG_EDGE), quality: 85, contentType: "image/webp" },
    { key: paths.download, size: { width, height }, quality: DOWNLOAD_QUALITY, contentType: "image/jpeg" },
  ];
  const uploaded: string[] = [];
  const protectedKeys = new Set(options?.keepOnFailure ?? []);
  try {
    for (const job of jobs) {
      const derivative = await watermarkedDerivative(body, job.size.width, job.size.height, job.quality, watermark, job.contentType === "image/jpeg" ? "jpeg" : "webp");
      await photoStore().uploadPhoto({
        key: job.key,
        body: derivative,
        contentType: job.contentType,
        upsert: options?.overwrite === true ? true : undefined,
      });
      uploaded.push(job.key);
    }
  } catch (error) {
    try { await photoStore().removePhotos(uploaded.filter(key => !protectedKeys.has(key))); } catch { /* Preserve the original failure. */ }
    throw error;
  }
  return { width, height, uploaded };
}

type ClientGalleryUploadPreparation = {
  ok: true;
  id: string;
  key: string;
  uploadUrl: string;
} | {
  ok: false;
  message: string;
  fallback?: boolean;
};

function photoMetadata(form: FormData) {
  return {
    gallery: value(form, "gallery_id"),
    folder: value(form, "folder_id"),
    filename: value(form, "filename").trim(),
    mimeType: value(form, "mime_type"),
    bytes: Number(value(form, "bytes")),
  };
}

function validPhotoMetadata({ filename, mimeType, bytes }: ReturnType<typeof photoMetadata>) {
  return Boolean(
    filename &&
    Number.isFinite(bytes) &&
    bytes > 0 &&
    (ALLOWED_PHOTO_TYPES as readonly string[]).includes(mimeType) &&
    bytes <= MAX_PHOTO_BYTES,
  );
}

function clientPhotoPaths(gallery: string, folder: string, id: string, filename: string) {
  return {
    original: `${gallery}/${folder}/${id}/${storageFilename(filename)}`,
    thumbnail: `${gallery}/${folder}/${id}/thumbnail.webp`,
    preview: `${gallery}/${folder}/${id}/preview.webp`,
    download: `${gallery}/${folder}/${id}/download.jpg`,
  };
}

export async function prepareClientGalleryUpload(form: FormData): Promise<ClientGalleryUploadPreparation> {
  const metadata = photoMetadata(form);
  const parsed = photoUploadSchema.safeParse({ gallery_id: metadata.gallery, folder_id: metadata.folder });
  if (!parsed.success || !validPhotoMetadata(metadata)) {
    return { ok: false, message: "Upload failed: use JPEG, PNG, WebP, or GIF images up to 15MB." };
  }
  const supabase = await db();
  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("id", parsed.data.folder_id)
    .eq("gallery_id", parsed.data.gallery_id)
    .maybeSingle();
  if (!folder) return { ok: false, message: "Upload failed: the selected folder is unavailable." };
  if (!isR2Provider()) {
    return { ok: false, message: "Direct upload is unavailable for the configured storage provider.", fallback: true };
  }
  const id = crypto.randomUUID();
  const key = clientPhotoPaths(parsed.data.gallery_id, folder.id, id, metadata.filename).original;
  try {
    return { ok: true, id, key, uploadUrl: await createSignedPutUrl(key, metadata.mimeType) };
  } catch {
    return { ok: false, message: "Upload failed: R2 storage is unavailable." };
  }
}

export async function completeClientGalleryUpload(form: FormData): Promise<{ ok: boolean; message?: string }> {
  const metadata = photoMetadata(form);
  const id = value(form, "id");
  const parsed = photoUploadSchema.safeParse({ gallery_id: metadata.gallery, folder_id: metadata.folder });
  if (!parsed.success || !id || !/^[0-9a-f-]{36}$/i.test(id) || !validPhotoMetadata(metadata)) {
    return { ok: false, message: "Upload failed: invalid photo metadata." };
  }
  if (!isR2Provider()) return { ok: false, message: "Upload failed: R2 storage is unavailable." };
  const supabase = await db();
  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("id", parsed.data.folder_id)
    .eq("gallery_id", parsed.data.gallery_id)
    .maybeSingle();
  if (!folder) return { ok: false, message: "Upload failed: the selected folder is unavailable." };
  const paths = clientPhotoPaths(parsed.data.gallery_id, folder.id, id, metadata.filename);
  if (value(form, "key") !== paths.original) {
    // The client must never choose its own key. Clean up any object it
    // managed to upload under the prepared key before rejecting.
    try {
      if (isClientPhotoStorageKey(value(form, "key"))) await photoStore().removePhotos([value(form, "key")]);
    } catch { /* Best-effort cleanup of a rejected upload. */ }
    return { ok: false, message: "Upload failed: invalid storage path." };
  }
  // Idempotent retry: a previous completion already recorded this photo.
  const { data: existing } = await supabase.from("photos").select("id,original_path").eq("id", id).maybeSingle();
  if (existing) {
    if (existing.original_path === paths.original) return { ok: true };
    // The id collides with a different photo; never touch the existing record.
    return { ok: false, message: "Upload failed: invalid photo reference." };
  }
  // A single read verifies integrity AND feeds derivative generation, so the
  // upload cannot race between a HEAD size-check and the GET (and one fewer
  // round trip to storage).
  const body = await downloadObjectBytes(paths.original);
  if (!body || body.byteLength !== metadata.bytes) {
    // Nothing was stored, or it is partial/corrupt. Removing a missing key is
    // an idempotent no-op, so cleanup is safe on either outcome.
    try { await photoStore().removePhotos([paths.original]); } catch { /* Best-effort cleanup. */ }
    return { ok: false, message: "Upload failed: the original file was not stored." };
  }
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", parsed.data.gallery_id)
    .eq("folder_id", folder.id);
  const uploadedPaths = [paths.original];
  let width: number | null = null;
  let height: number | null = null;
  try {
    const watermark = await activeWatermark(supabase);
    const derivatives = await storeWatermarkedDerivatives(body, { thumbnail: paths.thumbnail, preview: paths.preview, download: paths.download }, watermark);
    uploadedPaths.push(...derivatives.uploaded);
    width = derivatives.width;
    height = derivatives.height;
  } catch (error) {
    console.error(`client-gallery: failed to build client derivatives for ${paths.original}`, error);
    // No client-facing record is created unless the client derivatives
    // exist; the private original is only removed once nothing references it.
    try { await photoStore().removePhotos(uploadedPaths); } catch { /* Preserve the original failure. */ }
    return { ok: false, message: "Upload failed: the image could not be processed for delivery." };
  }
  const { error } = await supabase.from("photos").insert({
    id,
    gallery_id: parsed.data.gallery_id,
    folder_id: folder.id,
    filename: metadata.filename.slice(0, 500) || storageFilename(metadata.filename),
    original_path: paths.original,
    preview_path: paths.preview,
    thumbnail_path: paths.thumbnail,
    download_path: paths.download,
    width,
    height,
    mime_type: metadata.mimeType,
    bytes: metadata.bytes,
    sort_order: count ?? 0,
  });
  if (error) {
    try { await photoStore().removePhotos(uploadedPaths); } catch { /* Preserve the database failure. */ }
    return { ok: false, message: "Upload failed: the photo record could not be created." };
  }
  revalidatePath(`/admin/galleries/${parsed.data.gallery_id}`);
  revalidatePath(`/admin/galleries/${parsed.data.gallery_id}/${folder.id}`);
  return { ok: true };
}

export async function uploadPhotos(form: FormData) {
  const gallery=value(form,"gallery_id");
  const parsed=photoUploadSchema.safeParse({ gallery_id:gallery, folder_id:value(form,"folder_id") });
  if(!parsed.success) return galleryFail(gallery,"invalid-photo");
  return (await runFolderUpload(parsed.data.gallery_id, parsed.data.folder_id, form)) ?? galleryFail(gallery, "photo-upload");
}

export async function uploadPhotosAsync(form: FormData) {
  const gallery=value(form,"gallery_id");
  const parsed=photoUploadSchema.safeParse({ gallery_id:gallery, folder_id:value(form,"folder_id") });
  if(!parsed.success) return { ok:false as const };
  const config=await runFolderUpload(parsed.data.gallery_id, parsed.data.folder_id, form);
  if(!config) return { ok:false as const };
  revalidatePath(`/admin/galleries/${gallery}/${parsed.data.folder_id}`);
  return { ok:true as const, count: config.count };
}

async function runFolderUpload(gallery: string, folderId: string, form: FormData): Promise<{ count: number } | null> {
  const files=form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size>0);
  if(!files.length) return null;
  const supabase=await db();
  const { data: folder }=await supabase.from("folders").select("id").eq("id",folderId).eq("gallery_id",gallery).maybeSingle();
  if(!folder) return null;
  const { count }=await supabase.from("photos").select("id",{ count:"exact", head:true }).eq("gallery_id",gallery).eq("folder_id",folder.id);
  let sort=count??0;
  const watermark = await activeWatermark(supabase);
  for (const file of files) {
    if(!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type) || file.size>MAX_PHOTO_BYTES) return null;
    const id=crypto.randomUUID();
    const original_path=`${gallery}/${folder.id}/${id}/${storageFilename(file.name)}`;
    const thumbnail_path=`${gallery}/${folder.id}/${id}/thumbnail.webp`;
    const preview_path=`${gallery}/${folder.id}/${id}/preview.webp`;
    const download_path=`${gallery}/${folder.id}/${id}/download.jpg`;
    const uploadedPaths: string[] = [];
    const body=Buffer.from(await file.arrayBuffer());
    let width: number | null = null;
    let height: number | null = null;
    try {
      await photoStore().uploadPhoto({ key: original_path, body, contentType: file.type });
      uploadedPaths.push(original_path);
    } catch {
      return null;
    }
    try {
      const derivatives = await storeWatermarkedDerivatives(body, { thumbnail: thumbnail_path, preview: preview_path, download: download_path }, watermark);
      uploadedPaths.push(...derivatives.uploaded);
      width = derivatives.width;
      height = derivatives.height;
    } catch (error) {
      console.error(`client-gallery: failed to build client derivatives for ${original_path}`, error);
      // No client-facing record is created unless the client derivatives
      // exist; the private original is only removed once nothing references it.
      try { await photoStore().removePhotos(uploadedPaths); } catch { /* Preserve the original failure. */ }
      return null;
    }
    const { error: insertError }=await supabase.from("photos").insert({
      id,
      gallery_id:gallery,
      folder_id:folder.id,
      filename:file.name.trim().slice(0,500)||storageFilename(file.name),
      original_path,
      preview_path,
      thumbnail_path,
      download_path,
      width,
      height,
      mime_type:file.type,
      bytes:file.size,
      sort_order:sort,
    });
    if(insertError) {
      try { await photoStore().removePhotos(uploadedPaths); } catch { /* Preserve the database failure. */ }
      return null;
    }
    sort+=1;
  }
  revalidatePath(`/admin/galleries/${gallery}`);
  return { count: sort -(count??0) };
}
export async function deletePhoto(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const supabase=await db();
  const { data: photo }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path").eq("id",id).eq("gallery_id",gallery).maybeSingle();
  if(!photo) return;
  const paths=photoStoragePaths(photo);
  // DB-first so a failed delete never orphans storage objects behind a photo
  // that still exists (the pre-fix cover-FK failure purged them first).
  const { error }=await supabase.from("photos").delete().eq("id",id).eq("gallery_id",gallery);
  if(error) return redirect(`/admin/galleries/${gallery}?error=photo-delete`);
  if(paths.length){
    try {
      await photoStore().removePhotos(paths);
    } catch {
      return redirect(`/admin/galleries/${gallery}?error=photo-storage-delete`);
    }
  }
  revalidatePath(`/admin/galleries/${gallery}`);
}

export async function movePhotoToFolder(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const folder=value(form,"folder_id");
  const supabase=await db();
  const { data: target }=await supabase.from("folders").select("id").eq("id",folder).eq("gallery_id",gallery).maybeSingle();
  if(!target) return redirect(`/admin/galleries/${gallery}?error=invalid-photo`);
  await supabase.from("photos").update({ folder_id: target.id }).eq("id",id).eq("gallery_id",gallery);
  revalidatePath(`/admin/galleries/${gallery}`);
}

export async function movePhotos(form: FormData) {
  const gallery=value(form,"gallery_id"); const folder=value(form,"folder_id");
  const ids=form.getAll("ids").map(entry => String(entry)).filter(Boolean);
  if(!ids.length) return;
  const supabase=await db();
  const { data: target }=await supabase.from("folders").select("id").eq("id",folder).eq("gallery_id",gallery).maybeSingle();
  if(!target) return;
  await supabase.from("photos").update({ folder_id: target.id }).eq("gallery_id",gallery).in("id",ids);
  revalidatePath(`/admin/galleries/${gallery}`);
  revalidatePath(`/admin/galleries/${gallery}/${target.id}`);
}

export async function deletePhotos(form: FormData) {
  const gallery=value(form,"gallery_id"); const folder=value(form,"folder_id");
  const ids=form.getAll("ids").map(entry => String(entry)).filter(Boolean);
  if(!ids.length) return;
  const supabase=await db();
  const { data: photos }=await supabase.from("photos").select("id,original_path,preview_path,thumbnail_path,download_path").eq("gallery_id",gallery).in("id",ids);
  const paths=(photos??[]).flatMap(photoStoragePaths);
  // DB-first so a failed delete never orphans storage objects behind photos
  // that still exist (see deletePhoto).
  const { error }=await supabase.from("photos").delete().eq("gallery_id",gallery).in("id",ids);
  if(error) return redirect(`/admin/galleries/${gallery}?error=photos-delete`);
  if(paths.length){
    try {
      await photoStore().removePhotos(paths);
    } catch {
      return redirect(`/admin/galleries/${gallery}?error=photos-storage-delete`);
    }
  }
  revalidatePath(`/admin/galleries/${gallery}`);
  revalidatePath(`/admin/galleries/${gallery}/${folder}`);
}

/* ------------------------------------------------------------------ */
/* Apply the current watermark to existing photos                      */
/* ------------------------------------------------------------------ */

// Reuses activeWatermark(), storeWatermarkedDerivatives(),
// clientPhotoPaths() and photoStore so reprocessing is pixel-identical to a
// fresh upload (same logo, same sizing, same placement, same derivatives).
const WATERMARK_CONCURRENCY = 3;

type ReapplyPhoto = {
  id: string;
  folder_id: string;
  original_path: string;
  thumbnail_path: string | null;
  preview_path: string | null;
  download_path: string | null;
};

/**
 * Regenerate one existing photo's client-facing derivatives from its private
 * original using the CURRENT watermark. The original is only ever read, never
 * replaced. The new derivatives are stored first, the DB paths are updated only
 * after that succeeds, and then the obsolete old derivatives are removed. On
 * failure the photo keeps its previous valid derivatives and any newly written
 * files are cleaned up.
 */
async function reapplyPhotoWatermark(supabase: SupabaseClient<Database>, gallery: string, photo: ReapplyPhoto, watermark: ActiveWatermarkConfig): Promise<void> {
  const body = await photoStore().downloadBytes(photo.original_path);
  if (!body) throw new Error("original-unreadable");
  const paths = clientPhotoPaths(gallery, photo.folder_id, photo.id, photo.original_path.split("/").pop() ?? "photo.webp");
  const previous = [photo.thumbnail_path, photo.preview_path, photo.download_path].filter((path): path is string => Boolean(path));
  const derivatives = await storeWatermarkedDerivatives(
    body,
    { thumbnail: paths.thumbnail, preview: paths.preview, download: paths.download },
    watermark,
    { overwrite: true, keepOnFailure: previous },
  );
  const next = [paths.thumbnail, paths.preview, paths.download];
  const { error } = await supabase
    .from("photos")
    .update({ thumbnail_path: paths.thumbnail, preview_path: paths.preview, download_path: paths.download })
    .eq("id", photo.id)
    .eq("gallery_id", gallery);
  if (error) {
    // The photo still references its previous valid derivatives; drop only the
    // freshly written keys that are NOT those referenced paths so storage stays
    // consistent without ever breaking a live thumbnail/preview/download.
    try { await photoStore().removePhotos(derivatives.uploaded.filter(key => !previous.includes(key))); } catch { /* Preserve the database failure. */ }
    throw new Error("db-update-failed");
  }
  const obsolete = previous.filter(path => !next.includes(path));
  if (obsolete.length) {
    try { await photoStore().removePhotos(obsolete); } catch { /* A stale derivative is harmless. */ }
  }
}

export type ApplyWatermarkResult = {
  ok: boolean;
  message: string;
  succeeded: number;
  failed: number;
  failedIds: string[];
  total: number;
};

/**
 * Admin bulk action: (re)watermark existing photos with the current logo.
 * Each photo is processed from its stored private original with bounded
 * concurrency, and a single photo failure never blocks the others. Failed ids
 * are returned so the client can offer a targeted retry.
 */
export async function applyWatermarkToPhotos(form: FormData): Promise<ApplyWatermarkResult> {
  const gallery = value(form, "gallery_id");
  const folder = value(form, "folder_id");
  const ids = form.getAll("ids").map(entry => String(entry)).filter(Boolean);
  const total = ids.length;
  if (!total) return { ok: false, message: "No photos selected.", succeeded: 0, failed: 0, failedIds: [], total: 0 };
  const supabase = await db();
  const watermark = await activeWatermark(supabase);
  if (!watermark) {
    return { ok: false, message: "Watermarking is currently off. Add or enable a watermark logo in Settings → Watermark first.", succeeded: 0, failed: 0, failedIds: [], total };
  }
  const activeWatermarkConfig: ActiveWatermarkConfig = watermark;
  const query = supabase
    .from("photos")
    .select("id,folder_id,original_path,thumbnail_path,preview_path,download_path")
    .eq("gallery_id", gallery)
    .in("id", ids);
  const { data: photos } = folder ? await query.eq("folder_id", folder) : await query;
  const pending = photos ?? [];
  const succeeded: string[] = [];
  const failedIds: string[] = [];
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const photo = pending[next++];
      try {
        await reapplyPhotoWatermark(supabase, gallery, photo, activeWatermarkConfig);
        succeeded.push(photo.id);
      } catch (error) {
        console.error(`client-gallery: apply watermark failed for ${photo.id}`, error);
        failedIds.push(photo.id);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(WATERMARK_CONCURRENCY, pending.length) }, () => worker()));
  revalidatePath(`/admin/galleries/${gallery}`);
  if (folder) revalidatePath(`/admin/galleries/${gallery}/${folder}`);
  return {
    ok: succeeded.length > 0 && failedIds.length === 0,
    message: failedIds.length ? `${failedIds.length} of ${pending.length} photos failed.` : "Watermark applied.",
    succeeded: succeeded.length,
    failed: failedIds.length,
    failedIds,
    total: pending.length,
  };
}

/* ------------------------------------------------------------------ */
/* Storage orphan audit (admin-only, no prompt-safe web UI)            */
/* ------------------------------------------------------------------ */

async function referencedPhotoPaths(): Promise<Set<string>> {
  const supabase = await db();
  const { data } = await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path");
  const referenced = new Set<string>();
  for (const photo of data ?? []) for (const path of photoStoragePaths(photo)) referenced.add(path);
  return referenced;
}

/**
 * Read-only storage audit: list every object in the active provider bucket and
 * report the photo-shaped keys no gallery photo references. Returns
 * { ok:false } on storage-list failure so the caller can display it. Deletes
 * nothing.
 */
export async function auditStorageOrphans(): Promise<{ ok: boolean; count: number; keys: string[]; error?: string }> {
  try {
    const referenced = await referencedPhotoPaths();
    const orphans = await auditOrphans(referenced);
    return { ok: true, count: orphans.length, keys: orphans };
  } catch (error) {
    return { ok: false, count: 0, keys: [], error: error instanceof Error ? error.message : "Could not audit storage." };
  }
}

/**
 * Deliberate cleanup of explicit keys only. Each key must be photo-shaped AND
 * unreferenced by any gallery photo before it is removed; the DB rows are
 * never touched. Safe to call repeatedly (missing objects are idempotent).
 */
export async function cleanupStorageOrphans(keys: string[]): Promise<{ ok: boolean; removed: number; rejected: number }> {
  try {
    const referenced = await referencedPhotoPaths();
    const removed = await cleanupOrphans(keys, referenced);
    return { ok: true, removed: removed.length, rejected: keys.length - removed.length };
  } catch {
    return { ok: false, removed: 0, rejected: keys.length };
  }
}
