"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { ALLOWED_PHOTO_TYPES, GALLERY_ASSET_BUCKET, MAX_PHOTO_BYTES, clientSchema, folderSchema, gallerySchema, photoUploadSchema, slugify } from "@/lib/admin-validation";
import { hashGalleryPassword } from "@/lib/gallery-password";
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
async function db() { await requireAdmin(); return adminDb(); }
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
export async function createGallery(form: FormData) { const clientId=value(form,"client_id"); const fromGalleries=value(form,"from")==="galleries"; const fail=(code:string)=>redirect(`${fromGalleries||!clientId?"/admin/galleries":`/admin/clients/${clientId}`}?error=${code}`); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:clientId,description:value(form,"description"),slug:value(form,"slug"),status:value(form,"status")||"draft"}); if(!parsed.success) return fail("invalid-gallery"); const password=await galleryPasswordUpdate(form); if(!password.ok) return fail("invalid-gallery"); const supabase=await db(); const {data,error}=await supabase.from("galleries").insert({...parsed.data,description:parsed.data.description||null,...password.patch}).select("id").single(); if(error||!data) return fail("gallery-create"); redirect(`/admin/galleries/${data.id}`); }
export async function updateGallery(form: FormData) { const id=value(form,"id"); const parsed=gallerySchema.safeParse({title:value(form,"title"),client_id:value(form,"client_id"),description:value(form,"description"),slug:value(form,"slug"),status:value(form,"status")||"draft"}); if(!parsed.success) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const password=await galleryPasswordUpdate(form); if(!password.ok) return redirect(`/admin/galleries/${id}?error=invalid-gallery`); const supabase=await db(); await supabase.from("galleries").update({...parsed.data,description:parsed.data.description||null,...password.patch}).eq("id",id); revalidatePath(`/admin/galleries/${id}`); redirect(`/admin/galleries/${id}`); }
export async function deleteGallery(form: FormData) {
  const id=value(form,"id"), client=value(form,"client_id"); const supabase=await db();
  const { data: galleryPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path").eq("gallery_id",id);
  const paths=(galleryPhotos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path]).filter((path): path is string => Boolean(path));
  if(paths.length) await supabase.storage.from(GALLERY_ASSET_BUCKET).remove(paths);
  await supabase.from("galleries").delete().eq("id",id);
  redirect(`/admin/clients/${client}`);
}
export async function createFolder(form: FormData) { const gallery=value(form,"gallery_id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const description=value(form,"description").trim().slice(0,400)||null; const supabase=await db(); const {count}=await supabase.from("folders").select("id",{count:"exact",head:true}).eq("gallery_id",gallery); await supabase.from("folders").insert({gallery_id:gallery,name:parsed.data.name,slug,description,sort_order:count??0}); revalidatePath(`/admin/galleries/${gallery}`); }
export async function renameFolder(form: FormData) { const gallery=value(form,"gallery_id"),id=value(form,"id"), parsed=folderSchema.safeParse({name:value(form,"name")}); const slug=parsed.success?slugify(parsed.data.name):""; if(!parsed.success||!slug) return redirect(`/admin/galleries/${gallery}?error=invalid-folder`); const supabase=await db(); const description=value(form,"description").trim().slice(0,400)||null; await supabase.from("folders").update({name:parsed.data.name,slug,description}).eq("id",id).eq("gallery_id",gallery); revalidatePath(`/admin/galleries/${gallery}`); }
export async function deleteFolder(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const supabase=await db();
  const { data: folderPhotos }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path").eq("gallery_id",gallery).eq("folder_id",id);
  const paths=(folderPhotos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path]).filter((path): path is string => Boolean(path));
  if(paths.length) await supabase.storage.from(GALLERY_ASSET_BUCKET).remove(paths);
  await supabase.from("folders").delete().eq("id",id).eq("gallery_id",gallery);
  revalidatePath(`/admin/galleries/${gallery}`);
}
function galleryFail(gallery: string, code: string) { return redirect(`/admin/galleries/${gallery}?error=${code}`); }
function storageFilename(filename: string) { const trimmed=filename.trim().slice(0,500); const dot=trimmed.lastIndexOf("."); const ext=dot>0?trimmed.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g,""):""; return `${slugify(dot>0?trimmed.slice(0,dot):trimmed)||"photo"}${ext}`; }
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
    const { error: uploadError }=await supabase.storage.from(GALLERY_ASSET_BUCKET).upload(original_path, Buffer.from(await file.arrayBuffer()), { contentType:file.type, upsert:false });
    if(uploadError) return null;
    const { error: insertError }=await supabase.from("photos").insert({ id, gallery_id:gallery, folder_id:folder.id, filename:file.name.trim().slice(0,500)||storageFilename(file.name), original_path, mime_type:file.type, bytes:file.size, sort_order:sort });
    if(insertError) { await supabase.storage.from(GALLERY_ASSET_BUCKET).remove([original_path]); return null; }
    sort+=1;
  }
  revalidatePath(`/admin/galleries/${gallery}`);
  return { count: sort -(count??0) };
}
export async function deletePhoto(form: FormData) {
  const gallery=value(form,"gallery_id"); const id=value(form,"id"); const supabase=await db();
  const { data: photo }=await supabase.from("photos").select("original_path,preview_path,thumbnail_path").eq("id",id).eq("gallery_id",gallery).maybeSingle();
  if(photo) {
    const paths=[photo.original_path, photo.preview_path, photo.thumbnail_path].filter((path): path is string => Boolean(path));
    if(paths.length) await supabase.storage.from(GALLERY_ASSET_BUCKET).remove(paths);
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
  const { data: photos }=await supabase.from("photos").select("id,original_path,preview_path,thumbnail_path").eq("gallery_id",gallery).in("id",ids);
  const paths=(photos??[]).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path]).filter((path): path is string => Boolean(path));
  if(paths.length) await supabase.storage.from(GALLERY_ASSET_BUCKET).remove(paths);
  await supabase.from("photos").delete().eq("gallery_id",gallery).in("id",ids);
  revalidatePath(`/admin/galleries/${gallery}`);
  revalidatePath(`/admin/galleries/${gallery}/${folder}`);
}
