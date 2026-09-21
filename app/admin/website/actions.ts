"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/admin-validation";
import { ensureWebsiteGallery, websiteGalleryId, websiteImageKey } from "@/lib/site/website-gallery";
import { photoStore } from "@/lib/storage-provider";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const checked = (form: FormData, key: string) => value(form, key) === "on";
const revalidate = () => {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/contact");
};

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
  redirect(`${redirectTo}?saved=1`);
}

const extByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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
  redirect("/admin/website/home?saved=1");
}

export async function removeStory(form: FormData) {
  const id = value(form, "id");
  const gallery = value(form, "gallery_id");
  const supabase = await db();
  await supabase.from("site_stories").delete().eq("id", id);
  void gallery;
  revalidate();
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
  redirect("/admin/website/gallery?saved=1");
}

/* --------------------------- website gallery ------------------------------- */

export async function uploadWebsiteGalleryImages(form: FormData): Promise<{ ok: boolean; message?: string; count?: number }> {
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!files.length) return { ok: false, message: "Choose a photo to upload." };
  const supabase = await db();
  const target = await ensureWebsiteGallery(supabase);
  if (!target) return { ok: false, message: "Could not prepare the website gallery." };
  const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("gallery_id", target.galleryId);
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
        sort_order: (count ?? 0) + uploadedKeys.length,
      });
      if (error) throw new Error("website-photo-insert");
    }
  } catch {
    if (uploadedKeys.length) await photoStore().removePhotos(uploadedKeys);
    return { ok: false, message: "Could not store that image. Try again." };
  }
  revalidate();
  return { ok: true, count: uploadedKeys.length };
}

export async function deleteWebsiteGalleryImage(form: FormData) {
  const id = value(form, "id");
  const supabase = await db();
  const galleryId = await websiteGalleryId(supabase);
  if (!galleryId) return;
  const { data: photo } = await supabase
    .from("photos")
    .select("original_path,preview_path,thumbnail_path")
    .eq("id", id)
    .eq("gallery_id", galleryId)
    .maybeSingle();
  if (!photo) return;
  const paths = [photo.original_path, photo.preview_path, photo.thumbnail_path].filter((path): path is string => Boolean(path));
  if (paths.length) await photoStore().removePhotos(paths);
  await supabase.from("photos").delete().eq("id", id).eq("gallery_id", galleryId);
  revalidate();
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
  redirect("/admin/website/appearance?saved=1");
}