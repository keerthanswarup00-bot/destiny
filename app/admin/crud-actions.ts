"use server";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join as pathJoin } from "node:path";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, clientSchema, folderSchema, gallerySchema, photoUploadSchema, slugify } from "@/lib/admin-validation";
import { photoStore } from "@/lib/storage-provider";
import { createSignedPutUrl, downloadObjectBytes, objectBytes } from "@/lib/r2";
import { hashGalleryPassword } from "@/lib/gallery-password";
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
async function db() { await requireAdmin(); return adminDb(); }
async function invalidateTags(...tags: string[]) { await Promise.all(tags.map(tag => revalidateTag(tag))); }
export async function createClient(form: FormData) { const parsed = clientSchema.safeParse({ name:value(form,"name"), event_date:value(form,"date"), phone:value(form,"phone"), notes:value(form,"notes") }); if (!parsed.success) return redirect("/admin/clients?error=invalid-client"); const supabase = await db(); const { data, error } = await supabase.from("clients").insert({ ...parsed.data, event_date: parsed.data.event_date || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null }).select("id").single(); if (error || !data) return redirect("/admin/clients?error=client-create"); redirect(`/admin/clients/${data.id}`); }
export async function updateClient(form: FormData) { const id=value(form,"id"); const parsed=clientSchema.safeParse({name:value(form,"name"),event_date:value(form,"date"),phone:value(form,"phone"),notes:value(form,"notes")}); if(!parsed.success) return redirect(`/admin/clients/${id}?error=invalid-client`); const supabase=await db(); await supabase.from("clients").update({...parsed.data,event_date:parsed.data.event_date||null,phone:parsed.data.phone||null,notes:parsed.data.notes||null}).eq("id",id); revalidatePath(`/admin/clients/${id}`); redirect(`/admin/clients/${id}`); }
export async function deleteClient(form: FormData) { const id=value(form,"id"); const supabase=await db(); const {error}=await supabase.from("clients").delete().eq("id",id); redirect(error?`/admin/clients/${id}?error=client-has-galleries`:"/admin/clients"); }
async function galleryPasswordUpdate(form: FormData): Promise<{ ok: false } | { ok: true; patch: { password_hash?: string | null } }> {
  const password = value(form, "password");
  if (value(form, "clear_password") === "on") return { ok: true, patch: { password_hash: null } };
  if (!password) return { ok: true, patch: {} };
  if (password.trim().length < 6) return { ok: false };
  return { ok: true, patch: { password_hash: await hashGalleryPassword(password) } };
}
export async function createGallery(form: FormData) { const clientId=value(form,"client_id"); const fromGalleries=value(form,"from")==="galleries"; const fail=(code:string)=>redirect(`${fromGalleries||!clientId?"/admin/galleries":`/admin/clients/${clientId}`}?error=${code}`); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:clientId,description:"",slug:slugify(value(form,"title")),status:"draft"}); if(!parsed.success || !parsed.data.slug) return fail("invalid-gallery"); const password=await galleryPasswordUpdate(form); if(!password.ok) return fail("invalid-gallery"); const supabase=await db(); const {data,error}=await supabase.from("galleries").insert({...parsed.data,description:parsed.data.description||null,...password.patch}).select("id").single(); if(error||!data) return fail("gallery-create"); const { error: folderError } = await supabase.from("folders").insert({ gallery_id: data.id, name: "Photos", slug: "photos", sort_order: 0 }); if(folderError) { await supabase.from("galleries").delete().eq("id", data.id); return fail("gallery-create"); } redirect(`/admin/galleries/${data.id}`); }
export async function updateGallery(form: FormData) { const id=value(form,"id"); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:value(form,"client_id"),description:value(form,"description"),slug:value(form,"slug"),status:value(form,"status")||"draft"}); if(!parsed.success) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const password=await galleryPasswordUpdate(form); if(!password.ok) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const supabase=await db(); await supabase.from("galleries").update({...parsed.data,description:parsed.data.description||null,...password.patch}).eq("id",id); revalidatePath(`/admin/galleries/${id}`); await invalidateTags("site-stories", "site-portfolio"); redirect(`/admin/galleries/${id}`); }
export async function deleteGallery(form: FormData) {
  const id=value(form,"id"); const supabase=await db();
  const { data: galleryPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path").eq("gallery_id",id);
  const paths=(galleryPhotos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path, photo.download_path]).filter((path): path is string => Boolean(path));
  if(paths.length) {
    try {
      await photoStore().removePhotos(paths);
    } catch {
      return redirect(`/admin/galleries?error=gallery-storage-delete`);
    }
  }
  const { error }=await supabase.from("galleries").delete().eq("id",id);
  if(error) return redirect(`/admin/galleries?error=gallery-delete`);
  revalidatePath("/admin/galleries");
  await invalidateTags("site-stories", "site-portfolio");
  redirect("/admin/galleries");
}
export async function createFolder(form: FormData) { const gallery=value(form,"gallery_id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const description=value(form,"description").trim().slice(0,400)||null; const supabase=await db(); const {count}=await supabase.from("folders").select("id",{count:"exact",head:true}).eq("gallery_id",gallery); await supabase.from("folders").insert({gallery_id:gallery,name:parsed.data.name,slug,description,sort_order:count??0}); revalidatePath(`/admin/galleries/${gallery}`); }
export async function renameFolder(form: FormData) { const gallery=value(form,"gallery_id"),id=value(form,"id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const supabase=await db(); const description=value(form,"description").trim().slice(0,400)||null; await supabase.from("folders").update({name:parsed.data.name,slug,description}).eq("id",id).eq("gallery_id",gallery); revalidatePath(`/admin/galleries/${gallery}`); }
export async function deleteFolder(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const supabase=await db();
  const { data: folderPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path,download_path").eq("gallery_id",gallery).eq("folder_id",id);
  const paths=(folderPhotos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path, photo.download_path]).filter((path): path is string => Boolean(path));
  if(paths.length) await photoStore().removePhotos(paths);
  await supabase.from("folders").delete().eq("id",id).eq("gallery_id",gallery);
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

// The Destiny logo used as the watermark source. The owner drops the asset at
// this exact path; uploads fail closed when it is missing so that no
// unwatermarked image can ever reach a client.
const WATERMARK_ASSET_PATH = pathJoin(process.cwd(), "assets", "destiny-watermark.png");
const WATERMARK_WIDTH_RATIO = 0.12; // ≈12% of image width
const WATERMARK_MIN_WIDTH = 120;
const WATERMARK_MAX_WIDTH = 640;
const WATERMARK_MARGIN_X_RATIO = 0.03; // 3% of width from the right edge
const WATERMARK_MARGIN_Y_RATIO = 0.025; // 2.5% of height from the bottom edge
const WATERMARK_MIN_MARGIN = 16;

type WatermarkSource = { buffer: Buffer; width: number; height: number };
let watermarkSourceCache: WatermarkSource | null | undefined;

async function watermarkSource(): Promise<WatermarkSource> {
  if (watermarkSourceCache === undefined) {
    const buffer = await readFile(WATERMARK_ASSET_PATH);
    const info = await sharp(buffer).metadata();
    if (!info.width || !info.height) throw new Error("watermark-asset-invalid");
    watermarkSourceCache = { buffer, width: info.width, height: info.height };
  }
  return watermarkSourceCache!;
}

const resizedWatermarkCache = new Map<number, Buffer>();

async function resizedWatermark(logoWidth: number, source: WatermarkSource): Promise<Buffer> {
  let cached = resizedWatermarkCache.get(logoWidth);
  if (!cached) {
    const logoHeight = Math.max(1, Math.round(logoWidth * (source.height / source.width)));
    cached = await sharp(source.buffer)
      .resize({ width: logoWidth, height: logoHeight, fit: "fill" })
      .png()
      .toBuffer();
    resizedWatermarkCache.set(logoWidth, cached);
  }
  return cached;
}

/** Bottom-right placement inset proportional to the image size (never fixed px). */
function watermarkPlacement(imageWidth: number, imageHeight: number, logoWidth: number, logoHeight: number) {
  const marginX = Math.max(WATERMARK_MIN_MARGIN, Math.round(imageWidth * WATERMARK_MARGIN_X_RATIO));
  const marginY = Math.max(WATERMARK_MIN_MARGIN, Math.round(imageHeight * WATERMARK_MARGIN_Y_RATIO));
  return { left: Math.max(0, imageWidth - logoWidth - marginX), top: Math.max(0, imageHeight - logoHeight - marginY) };
}

function withinLongEdge(width: number, height: number, longEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= longEdge) return { width, height };
  const scale = longEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Watermarked WebP at the exact target size; the logo is not distorted. */
async function watermarkedDerivative(body: Buffer, targetWidth: number, targetHeight: number, quality: number): Promise<Buffer> {
  const source = await watermarkSource();
  const logoWidth = Math.min(Math.max(Math.round(targetWidth * WATERMARK_WIDTH_RATIO), WATERMARK_MIN_WIDTH), WATERMARK_MAX_WIDTH);
  const logoHeight = Math.max(1, Math.round(logoWidth * (source.height / source.width)));
  const logo = await resizedWatermark(logoWidth, source);
  const placement = watermarkPlacement(targetWidth, targetHeight, logoWidth, logoHeight);
  return sharp(body)
    .resize({ width: targetWidth, height: targetHeight, fit: "fill" })
    .composite([{ input: logo, left: placement.left, top: placement.top }])
    .webp({ quality })
    .toBuffer();
}

/**
 * Build and store the three watermarked client-facing derivatives.
 * All three must succeed; a photo with no watermarked derivatives is never
 * made visible to a client (previous rows that lost a derivative to a failed
 * upload were a security hole). On partial failure, the created derivatives
 * are removed before the error propagates.
 */
async function storeWatermarkedDerivatives(body: Buffer, paths: { thumbnail: string; preview: string; download: string }): Promise<{ width: number | null; height: number | null; uploaded: string[] }> {
  const metadata = await sharp(body).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("derivative-missing-dimensions");
  const jobs: { key: string; size: { width: number; height: number }; quality: number }[] = [
    { key: paths.thumbnail, size: withinLongEdge(width, height, THUMBNAIL_LONG_EDGE), quality: 80 },
    { key: paths.preview, size: withinLongEdge(width, height, PREVIEW_LONG_EDGE), quality: 85 },
    { key: paths.download, size: { width, height }, quality: DOWNLOAD_QUALITY },
  ];
  const uploaded: string[] = [];
  try {
    for (const job of jobs) {
      const derivative = await watermarkedDerivative(body, job.size.width, job.size.height, job.quality);
      await photoStore().uploadPhoto({ key: job.key, body: derivative, contentType: "image/webp" });
      uploaded.push(job.key);
    }
  } catch (error) {
    try { await photoStore().removePhotos(uploaded); } catch { /* Preserve the original failure. */ }
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
    download: `${gallery}/${folder}/${id}/download.webp`,
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
  if (value(form, "key") !== paths.original) return { ok: false, message: "Upload failed: invalid storage path." };
  if (await objectBytes(paths.original) !== metadata.bytes) return { ok: false, message: "Upload failed: the original file was not stored." };
  const body = await downloadObjectBytes(paths.original);
  if (!body) return { ok: false, message: "Upload failed: the original file could not be read." };
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", parsed.data.gallery_id)
    .eq("folder_id", folder.id);
  const uploadedPaths = [paths.original];
  let width: number | null = null;
  let height: number | null = null;
  try {
    const derivatives = await storeWatermarkedDerivatives(body, { thumbnail: paths.thumbnail, preview: paths.preview, download: paths.download });
    uploadedPaths.push(...derivatives.uploaded);
    width = derivatives.width;
    height = derivatives.height;
  } catch {
    // No client-facing record is created unless a watermarked derivative
    // exists; the private original is only removed once nothing references it.
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
  for (const file of files) {
    if(!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type) || file.size>MAX_PHOTO_BYTES) return null;
    const id=crypto.randomUUID();
    const original_path=`${gallery}/${folder.id}/${id}/${storageFilename(file.name)}`;
    const thumbnail_path=`${gallery}/${folder.id}/${id}/thumbnail.webp`;
    const preview_path=`${gallery}/${folder.id}/${id}/preview.webp`;
    const download_path=`${gallery}/${folder.id}/${id}/download.webp`;
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
      const derivatives = await storeWatermarkedDerivatives(body, { thumbnail: thumbnail_path, preview: preview_path, download: download_path });
      uploadedPaths.push(...derivatives.uploaded);
      width = derivatives.width;
      height = derivatives.height;
    } catch {
      // No client-facing record is created unless a watermarked derivative
      // exists; the private original is only removed once nothing references it.
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
  if(photo) {
    const paths=[photo.original_path, photo.preview_path, photo.thumbnail_path, photo.download_path].filter((path): path is string => Boolean(path));
    if(paths.length) await photoStore().removePhotos(paths);
    await supabase.from("photos").delete().eq("id",id).eq("gallery_id",gallery);
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
  const paths=(photos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path, photo.download_path]).filter((path): path is string => Boolean(path));
  if(paths.length) await photoStore().removePhotos(paths);
  await supabase.from("photos").delete().eq("gallery_id",gallery).in("id",ids);
  revalidatePath(`/admin/galleries/${gallery}`);
  revalidatePath(`/admin/galleries/${gallery}/${folder}`);
}
