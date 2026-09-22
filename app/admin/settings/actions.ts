"use server";

import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { photoStore } from "@/lib/storage-provider";
import { sampleWatermarkPhoto, validateWatermarkSettings, watermarkSourceFromBytes, watermarkedDerivative, type ActiveWatermarkConfig } from "@/lib/watermark-core";

async function db() { await requireAdmin(); return adminDb(); }
const formValue = (form: FormData, key: string) => String(form.get(key) ?? "");

const ALLOWED_WATERMARK_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];
const MAX_WATERMARK_BYTES = 5 * 1024 * 1024;
const WATERMARK_MIN_DIMENSION = 24;
const WATERMARK_MAX_DIMENSION = 6000;

export async function getWatermarkSettings() {
  const supabase = await db();
  const { data } = await supabase.from("site_branding").select("watermark_path,watermark_mime,watermark_enabled,watermark_opacity,watermark_scale,watermark_margin,watermark_position").eq("id", "branding").maybeSingle();
  const path = (data?.watermark_path as string | null) ?? null;
  const enabled = data?.watermark_enabled !== false;
  const settings = validateWatermarkSettings({
    enabled: data?.watermark_enabled,
    opacity: data?.watermark_opacity,
    scale: data?.watermark_scale,
    margin: data?.watermark_margin,
    position: data?.watermark_position,
  });
  let previewUrl: string | null = null;
  if (path) previewUrl = (await photoStore().signedGetUrls([path], 60 * 30)).get(path) ?? null;
  return { active: Boolean(path) && enabled, enabled, opacity: settings.opacity, scale: settings.scale, margin: settings.margin, position: settings.position, previewUrl };
}

export async function saveWatermark(form: FormData) {
  const supabase = await db();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return redirect("/admin/settings/watermark?error=invalid-asset");
  if (!(ALLOWED_WATERMARK_TYPES as readonly string[]).includes(file.type)) return redirect("/admin/settings/watermark?error=invalid-asset");
  if (file.size > MAX_WATERMARK_BYTES) return redirect("/admin/settings/watermark?error=invalid-asset");
  let bytes = Buffer.from(await file.arrayBuffer());
  try {
    bytes = await sharp(bytes).png().toBuffer();
    const info = await sharp(bytes).metadata();
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    if (width < WATERMARK_MIN_DIMENSION || height < WATERMARK_MIN_DIMENSION || width > WATERMARK_MAX_DIMENSION || height > WATERMARK_MAX_DIMENSION) {
      return redirect("/admin/settings/watermark?error=invalid-asset");
    }
  } catch {
    return redirect("/admin/settings/watermark?error=invalid-asset");
  }
  const { data: existing } = await supabase.from("site_branding").select("watermark_path").eq("id", "branding").maybeSingle();
  const previous = (existing?.watermark_path as string | null) ?? null;
  const key = `watermark/${crypto.randomUUID()}.png`;
  try {
    await photoStore().uploadPhoto({ key, body: bytes, contentType: "image/png" });
  } catch {
    return redirect("/admin/settings/watermark?error=storage");
  }
  const { error } = await supabase.from("site_branding").upsert(
    { id: "branding", watermark_path: key, watermark_mime: "image/png", watermark_enabled: true },
    { onConflict: "id" },
  );
  if (error) {
    try { await photoStore().removePhotos([key]); } catch { /* Preserve the validation failure. */ }
    return redirect("/admin/settings/watermark?error=invalid-asset");
  }
  if (previous && previous !== key) {
    try { await photoStore().removePhotos([previous]); } catch { /* The new logo is live; a stale object is harmless. */ }
  }
  redirect("/admin/settings/watermark?saved=1");
}

export async function removeWatermark(_form: FormData) {
  const supabase = await db();
  const { data: existing } = await supabase.from("site_branding").select("watermark_path").eq("id", "branding").maybeSingle();
  const path = (existing?.watermark_path as string | null) ?? null;
  const { error } = await supabase.from("site_branding").upsert(
    { id: "branding", watermark_path: null, watermark_mime: null, watermark_enabled: false },
    { onConflict: "id" },
  );
  if (error) return redirect("/admin/settings/watermark?error=invalid-asset");
  if (path) {
    try { await photoStore().removePhotos([path]); } catch { /* The watermark is off; a stale object is harmless. */ }
  }
  redirect("/admin/settings/watermark?saved=1");
}

export async function saveWatermarkSettings(form: FormData) {
  const settings = validateWatermarkSettings({
    enabled: formValue(form, "enabled") === "on",
    opacity: Number(formValue(form, "opacity")),
    scale: Number(formValue(form, "scale")),
    margin: Number(formValue(form, "margin")),
    position: formValue(form, "position"),
  });
  const supabase = await db();
  const { error } = await supabase
    .from("site_branding")
    .update({
      watermark_enabled: settings.enabled,
      watermark_opacity: settings.opacity,
      watermark_scale: settings.scale,
      watermark_margin: settings.margin,
      watermark_position: settings.position,
    })
    .eq("id", "branding");
  redirect(error ? "/admin/settings/watermark?error=settings" : "/admin/settings/watermark?saved=1");
}

export async function renderWatermarkPreview(form: FormData): Promise<{ url: string | null; error: string | null }> {
  const supabase = await db();
  const settings = validateWatermarkSettings({
    enabled: formValue(form, "enabled") === "on",
    opacity: Number(formValue(form, "opacity")),
    scale: Number(formValue(form, "scale")),
    margin: Number(formValue(form, "margin")),
    position: formValue(form, "position"),
  });
  const body = await sampleWatermarkPhoto();
  const metadata = await sharp(body).metadata();
  const width = metadata.width ?? 1600;
  const height = metadata.height ?? 1067;
  let watermark: ActiveWatermarkConfig | null = null;
  if (settings.enabled) {
    const { data } = await supabase.from("site_branding").select("watermark_path").eq("id", "branding").maybeSingle();
    const path = (data?.watermark_path as string | null) ?? null;
    if (path) {
      const bytes = await photoStore().downloadBytes(path);
      if (bytes) {
        const source = await watermarkSourceFromBytes(bytes, path);
        if (source) watermark = { source, settings };
      }
    }
  }
  try {
    const rendered = await watermarkedDerivative(body, width, height, 85, watermark);
    return { url: `data:image/webp;base64,${rendered.toString("base64")}`, error: null };
  } catch {
    return { url: null, error: "The preview could not be rendered." };
  }
}
