import "server-only";
import { galleryDb } from "@/lib/gallery-db";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";
import { CLIENT_SIGNED_URL_SECONDS, DOWNLOAD_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { downloadObjectBytes, deleteObject, objectBytes, objectExists, uploadObject, createSignedGetUrl } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export type PhotoStore = {
  uploadPhoto(opts: { key: string; body: Buffer; contentType: string; metadata?: Record<string, string> }): Promise<void>;
  removePhotos(keys: string[]): Promise<void>;
  signedGetUrls(keys: string[], seconds?: number): Promise<Map<string, string>>;
  signedDownloadUrl(key: string, filename: string, seconds?: number): Promise<string | null>;
  downloadBytes(key: string): Promise<Buffer | null>;
  objectBytes(key: string): Promise<number | null>;
  objectExists(key: string): Promise<boolean>;
};

function activeProvider(): "supabase" | "r2" {
  const value = process.env.PHOTO_STORAGE_PROVIDER;
  return value === "r2" ? "r2" : "supabase";
}

export function photoStore(): PhotoStore {
  return activeProvider() === "r2" ? r2PhotoStore : supabasePhotoStore;
}

const supabasePhotoStore: PhotoStore = {
  async uploadPhoto({ key, body, contentType, metadata }) {
    const supabase = await galleryDb();
    const options: { contentType: string; upsert: boolean; metadata?: Record<string, string> } = { contentType, upsert: false };
    if (metadata) options.metadata = metadata;
    const { error } = await supabase.storage.from(GALLERY_ASSET_BUCKET).upload(key, body, options);
    if (error) throw new Error("storage-upload-failed");
  },
  async removePhotos(keys) {
    if (!keys.length) return;
    const supabase = await galleryDb();
    await supabase.storage.from(GALLERY_ASSET_BUCKET).remove(keys);
  },
  async signedGetUrls(keys, seconds = CLIENT_SIGNED_URL_SECONDS) {
    if (!keys.length) return new Map();
    const unique = [...new Set(keys)];
    const supabase = await galleryDb();
    const { data } = await supabase.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(unique, seconds);
    return new Map((data ?? []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl!]));
  },
  async signedDownloadUrl(key, filename, seconds = DOWNLOAD_SIGNED_URL_SECONDS) {
    const supabase = await galleryDb();
    const { data } = await supabase.storage.from(GALLERY_ASSET_BUCKET).createSignedUrl(key, seconds, { download: filename });
    return data?.signedUrl ?? null;
  },
  async downloadBytes(key) {
    const supabase = await galleryDb();
    const { data, error } = await supabase.storage.from(GALLERY_ASSET_BUCKET).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  },
  async objectBytes(key) {
    const supabase = await galleryDb();
    const { data, error } = await supabase.storage.from(GALLERY_ASSET_BUCKET).download(key);
    if (error || !data) return null;
    return (await data.arrayBuffer()).byteLength;
  },
  async objectExists(key) {
    return (await supabasePhotoStore.objectBytes(key)) !== null;
  },
};

const r2PhotoStore: PhotoStore = {
  uploadPhoto({ key, body, contentType, metadata }) {
    return uploadObject({ key, body, contentType, metadata });
  },
  async removePhotos(keys) {
    for (const key of keys) if (key) await deleteObject(key);
  },
  async signedGetUrls(keys, seconds = CLIENT_SIGNED_URL_SECONDS) {
    const out = new Map<string, string>();
    for (const key of [...new Set(keys)]) out.set(key, await createSignedGetUrl(key, seconds));
    return out;
  },
  async signedDownloadUrl(key, filename, seconds = DOWNLOAD_SIGNED_URL_SECONDS) {
    return createSignedGetUrl(key, seconds, filename).catch(() => null);
  },
  downloadBytes: (key) => downloadObjectBytes(key),
  objectBytes: (key) => objectBytes(key),
  objectExists: (key) => objectExists(key),
};
