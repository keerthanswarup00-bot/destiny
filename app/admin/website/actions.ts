"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/admin-validation";
import { ensureWebsiteGallery, HIGHLIGHT_MAX_ZOOM, normalizeHighlightCrop, normalizeWebsiteGalleryCategory, websiteGalleryId, websiteImageKey } from "@/lib/site/website-gallery";
import { photoStore } from "@/lib/storage-provider";
import { createSignedPutUrl } from "@/lib/r2";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const checked = (form: FormData, key: string) => value(form, key) === "on";
const revalidate = () => {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/contact");
};

/** Invalidate cached public site-content reads. Tags mirror SITE_CACHE_TAGS in lib/site/site-content.ts. */
async function invalidateTags(...tags: string[]) {
  await Promise.all(tags.map(tag => revalidateTag(tag)));
}

async function db() {
  await requireAdmin();
  return adminDb();
}

async function getHomeRow(supabase: Awaited<ReturnType<typeof db>>) {
  const { data } = await supabase
    .from("site_home")
    .select("hero,what_we_document,stories,approach,cta")
    .eq("id", "home")
    .maybeSingle();
  return (data ?? {}) as Record<string, unknown>;
}

async function patchHome(section: string, patch: Record<string, unknown>, redirectTo: string) {
  const supabase = await db();
  const row = await getHomeRow(supabase);
  const previous = row[section] ?? {};
  const merged = { ...(previous as Record<string, unknown>), ...patch };
  await supabase.from("site_home").upsert({ id: "home", ...row, [section]: merged }, { onConflict: "id" });
  revalidate();
  await invalidateTags("site-home");
  redirect(`${redirectTo}?saved=1`);
}

const extByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type WebsiteUploadPreparation = {
  ok: true;
  id: string;
  key: string;
  uploadUrl: string;
} | {
  ok: false;
  message: string;
  fallback?: boolean;
};

function isR2Provider() {
  return process.env.PHOTO_STORAGE_PROVIDER?.trim().toLowerCase() === "r2";
}

export async function prepareWebsiteGalleryUpload(form: FormData): Promise<WebsiteUploadPreparation> {
  const filename = value(form, "filename").trim();
  const mimeType = value(form, "mime_type");
  const bytes = Number(value(form, "bytes"));
  const categoryValue = value(form, "category");
  const category = normalizeWebsiteGalleryCategory(categoryValue);
  if (!filename || !mimeType || !Number.isFinite(bytes) || bytes <= 0) return { ok: false, message: "Upload failed: invalid file metadata." };
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(mimeType) || bytes > MAX_PHOTO_BYTES) {
    return { ok: false, message: "Upload failed: use JPEG, PNG, WebP, or GIF images up to 15MB." };
  }
  if (categoryValue && !category) return { ok: false, message: "Upload failed: choose a valid category." };
  if (!isR2Provider()) return { ok: false, message: "Direct upload is unavailable for the configured storage provider.", fallback: true };
  const supabase = await db();
  const target = await ensureWebsiteGallery(supabase);
  if (!target) return { ok: false, message: "Upload failed: could not prepare the Website Gallery." };
  const id = crypto.randomUUID();
  const ext = extByMime[mimeType] ?? "png";
  const key = websiteImageKey(id, ext);
  try {
    return { ok: true, id, key, uploadUrl: await createSignedPutUrl(key, mimeType) };
  } catch {
    return { ok: false, message: "Upload failed: R2 storage is unavailable." };
  }
}

export async function completeWebsiteGalleryUpload(form: FormData): Promise<{ ok: boolean; message?: string }> {
  const id = value(form, "id");
  const key = value(form, "key");
  const filename = value(form, "filename").trim();
  const mimeType = value(form, "mime_type");
  const bytes = Number(value(form, "bytes"));
  const categoryValue = value(form, "category");
  const category = normalizeWebsiteGalleryCategory(categoryValue);
  if (!id || !key || !filename || !mimeType || !Number.isFinite(bytes)) return { ok: false, message: "Upload failed: invalid file metadata." };
  if (categoryValue && !category) return { ok: false, message: "Upload failed: choose a valid category." };
  const supabase = await db();
  const target = await ensureWebsiteGallery(supabase);
  if (!target) return { ok: false, message: "Upload failed: could not prepare the Website Gallery." };
  const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("gallery_id", target.galleryId);
  const { error } = await supabase.from("photos").insert({
    id,
    gallery_id: target.galleryId,
    folder_id: target.folderId,
    filename: filename.slice(0, 500),
    original_path: key,
    mime_type: mimeType,
    bytes,
    category: category ?? null,
    published_category: null,
    published: false,
    pending_delete: false,
    sort_order: (count ?? 0) + 1,
  });
  if (error) {
    try { await photoStore().removePhotos([key]); } catch { /* preserve database error */ }
    return { ok: false, message: "Upload failed: the photo record could not be created." };
  }
  revalidate();
  await invalidateTags("site-website-gallery");
  return { ok: true };
}

async function receiveAsset(form: FormData, field: string, previous: Record<string, unknown>): Promise<Record<string, unknown>> {
  const file = form.get(field);
  let patch: Record<string, unknown> = {};
  if (checked(form, `remove_${field}`)) {
    if (typeof previous.image_path === "string" || typeof previous[`${field}_path`] === "string") {
      const old = (previous.image_path ?? previous[`${field}_path`]) as string;
      await photoStore().removePhotos([old]);
    }
    patch = { image_path: null, image_mime: null, image_bytes: null, [`${field}_path`]: null, [`${field}_mime`]: null, [`${field}_bytes`]: null };
  } else if (file instanceof File && file.size > 0) {
    if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type) || file.size > MAX_PHOTO_BYTES) {
      throw new Error("invalid-asset");
    }
    const ext = extByMime[file.type] ?? "png";
    const old = (previous.image_path ?? previous[`${field}_path`]) as string | null;
    const key = `website/${crypto.randomUUID()}.${ext}`;
    await photoStore().uploadPhoto({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
    if (old) await photoStore().removePhotos([old]);
    patch = { image_path: key, image_mime: file.type, image_bytes: file.size, [`${field}_path`]: key, [`${field}_mime`]: file.type, [`${field}_bytes`]: file.size };
  }
  return patch;
}

/* -------------------------------- home: hero ------------------------------- */

export async function saveHomeHero(form: FormData) {
  const previous = await getHomeRow(await db());
  const hero = { ...(previous.hero as Record<string, unknown>) };
  const asset = await receiveAsset(form, "image", hero);
  await patchHome(
    "hero",
    {
      eyebrow: value(form, "eyebrow").trim().slice(0, 120),
      heading: value(form, "heading").trim().slice(0, 300),
      description: value(form, "description").trim().slice(0, 2000),
      primary_label: value(form, "primary_label").trim().slice(0, 60),
      primary_url: value(form, "primary_url").trim().slice(0, 200) || "/gallery",
      secondary_label: value(form, "secondary_label").trim().slice(0, 60),
      secondary_url: value(form, "secondary_url").trim().slice(0, 200) || "/contact",
      ...asset,
    },
    "/admin/website/home",
  );
}

/* ------------------------ home: what we document --------------------------- */

export async function saveWhatWeDocument(form: FormData) {
  const labels = form.getAll("labels").map((entry) => String(entry).trim().slice(0, 60)).filter(Boolean);
  await patchHome(
    "what_we_document",
    { enabled: checked(form, "enabled"), label: value(form, "label").trim().slice(0, 120), items: labels.map((label) => ({ label })) },
    "/admin/website/home",
  );
}

/* ------------------------- home: stories config ---------------------------- */

export async function saveStoriesConfig(form: FormData) {
  await patchHome(
    "stories",
    { enabled: checked(form, "enabled"), title: value(form, "title").trim().slice(0, 200), description: value(form, "description").trim().slice(0, 2000) },
    "/admin/website/home",
  );
}

/* ------------------------------ home: approach ----------------------------- */

export async function saveApproach(form: FormData) {
  const previous = await getHomeRow(await db());
  const approach = { ...(previous.approach as Record<string, unknown>) };
  const asset = await receiveAsset(form, "image", approach);
  const count = Math.min(12, Math.max(0, Number(value(form, "principle_count")) || 0));
  const principles: { label: string; description: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    principles.push({ label: value(form, `p_label_${index}`).trim().slice(0, 80), description: value(form, `p_desc_${index}`).trim().slice(0, 1000) });
  }
  await patchHome(
    "approach",
    { enabled: checked(form, "enabled"), label: value(form, "label").trim().slice(0, 120), heading: value(form, "heading").trim().slice(0, 500), body: value(form, "body").trim().slice(0, 2000), principles, ...asset },
    "/admin/website/home",
  );
}

/* -------------------------------- home: cta -------------------------------- */

export async function saveCta(form: FormData) {
  await patchHome(
    "cta",
    {
      enabled: checked(form, "enabled"),
      label: value(form, "label").trim().slice(0, 120),
      heading: value(form, "heading").trim().slice(0, 300),
      description: value(form, "description").trim().slice(0, 2000),
      button_text: value(form, "button_text").trim().slice(0, 60),
      button_url: value(form, "button_url").trim().slice(0, 200) || "/contact",
    },
    "/admin/website/home",
  );
}

/* ------------------------- home: featured stories --------------------------- */

export async function saveStoryRow(form: FormData) {
  const id = value(form, "id");
  const supabase = await db();
  await supabase
    .from("site_stories")
    .update({ title: value(form, "title").trim().slice(0, 200) || null, sort_order: Math.max(0, Number(value(form, "sort_order")) || 0), published: checked(form, "published") })
    .eq("id", id);
  revalidate();
  await invalidateTags("site-stories");
  redirect("/admin/website/home?saved=1");
}

export async function removeStory(form: FormData) {
  const id = value(form, "id");
  const gallery = value(form, "gallery_id");
  const supabase = await db();
  await supabase.from("site_stories").delete().eq("id", id);
  void gallery;
  revalidate();
  await invalidateTags("site-stories");
  redirect("/admin/website/gallery?saved=1");
}

/* --------------------------- gallery portfolio ------------------------------ */

export async function saveGalleryPortfolio(form: FormData) {
  const id = value(form, "id");
  const supabase = await db();
  const title = value(form, "title").trim().slice(0, 200) || null;
  const description = value(form, "description").trim().slice(0, 5000) || null;
  const category = value(form, "category").trim().slice(0, 100) || null;
  const location = value(form, "location").trim().slice(0, 200) || null;
  let eventDate = value(form, "event_date").trim() || null;
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) eventDate = null;
  const showInPortfolio = checked(form, "show_in_portfolio");
  const portfolioSort = Math.max(0, Number(value(form, "portfolio_sort")) || 0);
  const featured = checked(form, "featured");
  await supabase
    .from("galleries")
    .update({ title: title ?? undefined, description, category, location, event_date: eventDate, show_in_portfolio: showInPortfolio, portfolio_sort: portfolioSort })
    .eq("id", id);
  const { data: story } = await supabase.from("site_stories").select("id").eq("gallery_id", id).maybeSingle();
  if (featured && !story) {
    await supabase.from("site_stories").insert({ gallery_id: id, sort_order: portfolioSort, category, location, event_date: eventDate });
  } else if (featured && story) {
    await supabase
      .from("site_stories")
      .update({ category, location, event_date: eventDate, sort_order: portfolioSort })
      .eq("id", story.id);
  } else if (!featured && story) {
    await supabase.from("site_stories").delete().eq("id", story.id);
  }
  revalidate();
  await invalidateTags("site-stories", "site-portfolio");
  redirect("/admin/website/gallery?saved=1");
}

/* --------------------------- website gallery ------------------------------- */

export async function uploadWebsiteGalleryImages(form: FormData): Promise<{ ok: boolean; message?: string; count?: number }> {
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!files.length) return { ok: false, message: "Choose a photo to upload." };
  const category = normalizeWebsiteGalleryCategory(value(form, "category"));
  if (value(form, "category") && !category) return { ok: false, message: "Choose a valid website gallery category." };
  const supabase = await db();
  const target = await ensureWebsiteGallery(supabase);
  if (!target) return { ok: false, message: "Could not prepare the website gallery." };
  const { count, error: countError } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("gallery_id", target.galleryId);
  if (countError) return { ok: false, message: `Could not prepare the upload: ${countError.message}` };
  const uploadedKeys: string[] = [];
  try {
    for (const file of files) {
      if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type) || file.size > MAX_PHOTO_BYTES) {
        if (uploadedKeys.length) await photoStore().removePhotos(uploadedKeys);
        return { ok: false, message: "Use JPEG, PNG, WebP, or GIF images up to 15MB." };
      }
      const id = crypto.randomUUID();
      const ext = extByMime[file.type] ?? "png";
      const key = websiteImageKey(id, ext);
      await photoStore().uploadPhoto({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
      uploadedKeys.push(key);
      const { error } = await supabase.from("photos").insert({
        id,
        gallery_id: target.galleryId,
        folder_id: target.folderId,
        filename: file.name.trim().slice(0, 500) || `photo-${id}.${ext}`,
        original_path: key,
        mime_type: file.type,
        bytes: file.size,
        category: category ?? null,
        published_category: null,
        published: false,
        pending_delete: false,
        sort_order: (count ?? 0) + uploadedKeys.length,
      });
      if (error) throw new Error(`Photo record could not be created: ${error.message}`);
    }

  } catch (error) {
    if (uploadedKeys.length) {
      try {
        await photoStore().removePhotos(uploadedKeys);
      } catch {
        // Preserve the original upload/database failure for the admin UI.
      }
    }
    return {
      ok: false,
      message: error instanceof Error && error.message
        ? error.message
        : "Could not store that image. Try again.",
    };
  }
  revalidate();
  await invalidateTags("site-website-gallery");
  return { ok: true, count: uploadedKeys.length };
}

export async function updateWebsiteGalleryImageCategory(form: FormData) {
  const id = value(form, "id");
  const categoryValue = value(form, "category");
  const category = normalizeWebsiteGalleryCategory(categoryValue);
  if (categoryValue && !category) return;
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) return;
  const { error } = await supabase
    .from("photos")
    .update({ category })
    .eq("id", id)
    .eq("gallery_id", galleryId)
    .eq("pending_delete", false);
  if (error) throw new Error(`Category could not be updated: ${error.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
}

export async function deleteWebsiteGalleryImage(form: FormData) {
  const id = value(form, "id");
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) return;
  const { error } = await supabase
    .from("photos")
    .update({ pending_delete: true })
    .eq("id", id)
    .eq("gallery_id", galleryId);
  if (error) throw new Error(`Image could not be marked for deletion: ${error.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
}

export async function deleteWebsiteGalleryImages(form: FormData) {
  const ids = form.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) return;
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) return;
  const { error } = await supabase
    .from("photos")
    .update({ pending_delete: true })
    .in("id", ids)
    .eq("gallery_id", galleryId);
  if (error) throw new Error(`Images could not be marked for deletion: ${error.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
}

export async function setWebsiteGalleryHighlight(form: FormData) {
  const id = value(form, "id");
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId || !id) return redirect("/admin/website/gallery?saved=1");
  const { error } = await supabase
    .from("photos")
    .select("id")
    .eq("id", id)
    .eq("gallery_id", galleryId)
    .eq("pending_delete", false)
    .maybeSingle();
  if (error) throw new Error(`Highlight could not be set: ${error.message}`);
  const { error: updateError } = await supabase
    .from("galleries")
    .update({ highlight_photo_id: id, highlight_crop: null })
    .eq("id", galleryId);
  if (updateError) throw new Error(`Highlight could not be set: ${updateError.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
  redirect("/admin/website/gallery?highlight=1");
}

export async function removeWebsiteGalleryHighlight(form: FormData) {
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) return redirect("/admin/website/gallery?saved=1");
  void form;
  const { error } = await supabase
    .from("galleries")
    .update({ highlight_photo_id: null, highlight_crop: null })
    .eq("id", galleryId);
  if (error) throw new Error(`Highlight could not be removed: ${error.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
  redirect("/admin/website/gallery?saved=1");
}

export async function saveWebsiteGalleryHighlightCrop(form: FormData) {
  const id = value(form, "id");
  const crop = normalizeHighlightCrop({ x: Number(value(form, "x")), y: Number(value(form, "y")), zoom: Number(value(form, "zoom")) });
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId || !id || !crop) return redirect("/admin/website/gallery?saved=1");
  const { data: gallery } = await supabase
    .from("galleries")
    .select("highlight_photo_id")
    .eq("id", galleryId)
    .maybeSingle();
  if (gallery?.highlight_photo_id !== id) return redirect("/admin/website/gallery?saved=1");
  const rounded = {
    x: Math.round(crop.x * 10000) / 10000,
    y: Math.round(crop.y * 10000) / 10000,
    zoom: Math.round(Math.min(HIGHLIGHT_MAX_ZOOM, Math.max(1, crop.zoom)) * 100) / 100,
  };
  const { error } = await supabase
    .from("galleries")
    .update({ highlight_crop: rounded })
    .eq("id", galleryId);
  if (error) throw new Error(`Crop could not be saved: ${error.message}`);
  revalidate();
  await invalidateTags("site-website-gallery");
  redirect("/admin/website/gallery?crop=1");
}

export async function publishWebsiteGallery(): Promise<void> {
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) throw new Error("Website Gallery is not available.");
  const { data: pending, error: pendingError } = await supabase
    .from("photos")
    .select("id,original_path,preview_path,thumbnail_path,pending_delete")
    .eq("gallery_id", galleryId)
    .eq("pending_delete", true);
  if (pendingError) throw new Error(`Publish could not read pending deletions: ${pendingError.message}`);
  try {
    if (pending?.length) {
      const { error } = await supabase.from("photos").delete().in("id", pending.map(photo => photo.id)).eq("gallery_id", galleryId);
      if (error) throw error;
    }
    const paths = (pending ?? []).flatMap(photo => [photo.original_path, photo.preview_path, photo.thumbnail_path])
      .filter((path): path is string => Boolean(path));
    if (paths.length) await photoStore().removePhotos(paths);
    const { data: working, error: workingError } = await supabase.from("photos").select("id,category").eq("gallery_id", galleryId);
    if (workingError) throw workingError;
    for (const photo of working ?? []) {
      const { error: updateError } = await supabase
        .from("photos")
        .update({ published_category: photo.category, published: true, pending_delete: false })
        .eq("id", photo.id)
        .eq("gallery_id", galleryId);
      if (updateError) throw updateError;
    }
  } catch {
    throw new Error("Could not publish the Website Gallery. Retry the publish operation.");
  }
  revalidate();
  await invalidateTags("site-website-gallery");
  redirect("/admin/website/gallery?published=1");
}

/* --------------------------------- contact ---------------------------------- */

export async function saveContact(form: FormData) {
  const supabase = await db();
  await supabase.from("site_contact").upsert(
    {
      id: "contact",
      studio_name: value(form, "studio_name").trim().slice(0, 200) || null,
      email: value(form, "email").trim().slice(0, 320) || null,
      phone: value(form, "phone").trim().slice(0, 50) || null,
      whatsapp: value(form, "whatsapp").trim().slice(0, 50) || null,
      instagram: value(form, "instagram").trim().slice(0, 200) || null,
      location: value(form, "location").trim().slice(0, 200) || null,
      address: value(form, "address").trim().slice(0, 1000) || null,
      hours: value(form, "hours").trim().slice(0, 500) || null,
      heading: value(form, "heading").trim().slice(0, 200) || null,
      description: value(form, "description").trim().slice(0, 2000) || null,
      cta_text: value(form, "cta_text").trim().slice(0, 120) || null,
    },
    { onConflict: "id" },
  );
  revalidate();
  await invalidateTags("site-contact");
  redirect("/admin/website/contact?saved=1");
}

/* -------------------------------- branding ---------------------------------- */

const brandingFields = ["logo", "light_logo", "dark_logo", "favicon", "social_image"] as const;

export async function saveBranding(form: FormData) {
  const supabase = await db();
  const { data: existing } = await supabase.from("site_branding").select("*").eq("id", "branding").maybeSingle();
  const patch: Record<string, unknown> = {};
  for (const field of brandingFields) {
    const previous = existing?.[`${field}_path`] as string | null | undefined;
    const file = form.get(field);
    if (checked(form, `remove_${field}`)) {
      if (previous) await photoStore().removePhotos([previous]);
      patch[`${field}_path`] = null;
      patch[`${field}_mime`] = null;
    } else if (file instanceof File && file.size > 0) {
      if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type) || file.size > MAX_PHOTO_BYTES) {
        return redirect("/admin/website/branding?error=invalid-asset");
      }
      const ext = extByMime[file.type] ?? "png";
      const key = `website/${field}/${crypto.randomUUID()}.${ext}`;
      await photoStore().uploadPhoto({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
      if (previous) await photoStore().removePhotos([previous]);
      patch[`${field}_path`] = key;
      patch[`${field}_mime`] = file.type;
    }
  }
  await supabase.from("site_branding").upsert(
    {
      id: "branding",
      brand_name: value(form, "brand_name").trim().slice(0, 120) || null,
      short_name: value(form, "short_name").trim().slice(0, 40) || null,
      tagline: value(form, "tagline").trim().slice(0, 200) || null,
      ...patch,
    },
    { onConflict: "id" },
  );
  revalidate();
  await invalidateTags("site-branding");
  redirect("/admin/website/branding?saved=1");
}

/* ---------------------------------- theme ----------------------------------- */

export async function saveTheme(form: FormData) {
  const preset = value(form, "preset");
  const accent = value(form, "accent").trim().toUpperCase();
  const supabase = await db();
  await supabase.from("site_theme").upsert(
    {
      id: "theme",
      preset: ["destiny-yellow", "mono", "warm-ivory", "soft-stone", "black"].includes(preset) ? preset : "destiny-yellow",
      accent: /^#[0-9A-F]{6}$/.test(accent) ? accent : null,
    },
    { onConflict: "id" },
  );
  revalidate();
  await invalidateTags("site-theme");
  redirect("/admin/website/appearance?saved=1");
}
