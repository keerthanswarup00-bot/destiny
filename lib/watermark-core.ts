import "server-only";

import sharp from "sharp";

export type WatermarkSource = { key: string; buffer: Buffer; width: number; height: number };

export const WATERMARK_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

export type WatermarkSettings = {
  enabled: boolean;
  opacity: number;
  scale: number;
  margin: number;
  position: WatermarkPosition;
};

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: true,
  opacity: 1,
  scale: 0.12,
  margin: 0.03,
  position: "bottom-right",
};

export type ActiveWatermarkConfig = { source: WatermarkSource; settings: WatermarkSettings };

const WATERMARK_MIN_WIDTH = 120;
const WATERMARK_MAX_WIDTH = 640;
const WATERMARK_MIN_MARGIN = 8;
const WATERMARK_OPACITY_RANGE: readonly [number, number] = [0.05, 1];
const WATERMARK_SCALE_RANGE: readonly [number, number] = [0.03, 0.5];
const WATERMARK_MARGIN_RANGE: readonly [number, number] = [0, 0.25];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function validateWatermarkSettings(raw?: {
  enabled?: unknown;
  opacity?: unknown;
  scale?: unknown;
  margin?: unknown;
  position?: unknown;
} | null): WatermarkSettings {
  const opacity = toNumber(raw?.opacity);
  const scale = toNumber(raw?.scale);
  const margin = toNumber(raw?.margin);
  const position = raw?.position;
  return {
    enabled: raw?.enabled !== false,
    opacity: opacity === null ? DEFAULT_WATERMARK_SETTINGS.opacity : clamp(opacity, ...WATERMARK_OPACITY_RANGE),
    scale: scale === null ? DEFAULT_WATERMARK_SETTINGS.scale : clamp(scale, ...WATERMARK_SCALE_RANGE),
    margin: margin === null ? DEFAULT_WATERMARK_SETTINGS.margin : clamp(margin, ...WATERMARK_MARGIN_RANGE),
    position: typeof position === "string" && (WATERMARK_POSITIONS as readonly string[]).includes(position)
      ? (position as WatermarkPosition)
      : DEFAULT_WATERMARK_SETTINGS.position,
  };
}

export function logoWidthFor(imageWidth: number, settings: WatermarkSettings) {
  return Math.min(Math.max(Math.round(imageWidth * settings.scale), WATERMARK_MIN_WIDTH), WATERMARK_MAX_WIDTH);
}

export function watermarkPlacement(imageWidth: number, imageHeight: number, logoWidth: number, logoHeight: number, settings: WatermarkSettings) {
  const marginX = Math.max(WATERMARK_MIN_MARGIN, Math.round(imageWidth * settings.margin));
  const marginY = Math.max(WATERMARK_MIN_MARGIN, Math.round(imageHeight * settings.margin));
  switch (settings.position) {
    case "top-left":
      return { left: marginX, top: marginY };
    case "top-right":
      return { left: Math.max(0, imageWidth - logoWidth - marginX), top: marginY };
    case "bottom-left":
      return { left: marginX, top: Math.max(0, imageHeight - logoHeight - marginY) };
    case "center":
      return { left: Math.max(0, Math.round((imageWidth - logoWidth) / 2)), top: Math.max(0, Math.round((imageHeight - logoHeight) / 2)) };
    case "bottom-right":
    default:
      return { left: Math.max(0, imageWidth - logoWidth - marginX), top: Math.max(0, imageHeight - logoHeight - marginY) };
  }
}

export async function watermarkSourceFromBytes(bytes: Buffer, key: string): Promise<WatermarkSource | null> {
  try {
    const buffer = await sharp(bytes).png().toBuffer();
    const info = await sharp(buffer).metadata();
    if (!info.width || !info.height) return null;
    return { key, buffer, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

const resizedWatermarkCache = new Map<string, Buffer>();

async function resizedWatermark(logoWidth: number, source: WatermarkSource): Promise<Buffer> {
  const cacheKey = `${source.key}:${logoWidth}`;
  let cached = resizedWatermarkCache.get(cacheKey);
  if (!cached) {
    const logoHeight = Math.max(1, Math.round(logoWidth * (source.height / source.width)));
    cached = await sharp(source.buffer).resize({ width: logoWidth, height: logoHeight, fit: "fill" }).png().toBuffer();
    resizedWatermarkCache.set(cacheKey, cached);
  }
  return cached;
}

async function fadeWatermarkLogo(logo: Buffer, opacity: number): Promise<Buffer> {
  const safe = clamp(opacity, ...WATERMARK_OPACITY_RANGE);
  if (safe >= 1) return logo;
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * safe);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

export type DerivativeFormat = "webp" | "jpeg";

export async function watermarkedDerivative(
  body: Buffer,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  watermark: ActiveWatermarkConfig | null,
  format: DerivativeFormat = "webp",
): Promise<Buffer> {
  const pipeline = sharp(body).resize({ width: targetWidth, height: targetHeight, fit: "fill" });
  if (watermark) {
    const { source, settings } = watermark;
    const aspect = source.height / source.width;
    const marginX = Math.max(WATERMARK_MIN_MARGIN, Math.round(targetWidth * settings.margin));
    const marginY = Math.max(WATERMARK_MIN_MARGIN, Math.round(targetHeight * settings.margin));
    const availableWidth = Math.max(1, targetWidth - marginX);
    const availableHeight = Math.max(1, targetHeight - marginY);
    let logoWidth = logoWidthFor(targetWidth, settings);
    const fit = Math.min(availableWidth / logoWidth, availableHeight / (logoWidth * aspect));
    if (fit < 1) logoWidth = Math.max(1, Math.floor(logoWidth * fit));
    const logoHeight = Math.max(1, Math.round(logoWidth * aspect));
    const logo = await fadeWatermarkLogo(await resizedWatermark(logoWidth, source), settings.opacity);
    const placement = watermarkPlacement(targetWidth, targetHeight, logoWidth, logoHeight, settings);
    pipeline.composite([{ input: logo, left: placement.left, top: placement.top }]);
  }
  if (format === "jpeg") {
    // JPEG cannot carry alpha; flatten transparent sources onto white so the
    // downloaded photo never ships with an opaque black background.
    return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality }).toBuffer();
  }
  return pipeline.webp({ quality }).toBuffer();
}

const SAMPLE_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#33566e"/><stop offset=".45" stop-color="#bfa173"/><stop offset="1" stop-color="#6b4a38"/></linearGradient><radialGradient id="glow" cx=".72" cy=".28" r=".95"><stop offset="0" stop-color="#fff8e0" stop-opacity=".55"/><stop offset="1" stop-color="#fff8e0" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="1067" fill="url(#g)"/><rect width="1600" height="1067" fill="url(#glow)"/><circle cx="1150" cy="300" r="210" fill="#ffd98a" opacity=".5"/><circle cx="420" cy="790" r="330" fill="#24170f" opacity=".35"/><path d="M0 890 Q620 760 1600 930 L1600 1067 L0 1067 Z" fill="#182118" opacity=".55"/></svg>`;

let samplePhotoCache: Buffer | null = null;

export async function sampleWatermarkPhoto(): Promise<Buffer> {
  if (!samplePhotoCache) samplePhotoCache = await sharp(Buffer.from(SAMPLE_PHOTO_SVG)).png().toBuffer();
  return samplePhotoCache;
}