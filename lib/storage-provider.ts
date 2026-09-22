import "server-only";
import { galleryDb } from "@/lib/gallery-db";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";
import { CLIENT_SIGNED_URL_SECONDS, DOWNLOAD_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { downloadObjectBytes, deleteObject, objectBytes, objectExists, uploadObject, createSignedGetUrl, headObject } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const R2_DELETE_CONCURRENCY = 8;

async function removeR2Objects(keys: string[]) {
  const pending = [...new Set(keys.filter(Boolean))];
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const index = next++;
      await deleteObject(pending[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(R2_DELETE_CONCURRENCY, pending.length) }, () => worker())
  );
}

export type PhotoStore = {
  uploadPhoto(opts: { key: string; body: Buffer; contentType: string; metadata?: Record<string, string>; upsert?: boolean }): Promise<void>;
  removePhotos(keys: string[]): Promise<void>;
  signedGetUrls(keys: string[], seconds?: number): Promise<Map<string, string>>;
  signedDownloadUrl(key: string, filename: string, seconds?: number): Promise<string | null>;
  downloadBytes(key: string): Promise<Buffer | null>;
  objectBytes(key: string): Promise<number | null>;
  objectExists(key: string): Promise<boolean>;
};

function activeProvider(): "supabase" | "r2" {
  const value = process.env.PHOTO_STORAGE_PROVIDER?.toLowerCase();
  return value === "r2" ? "r2" : "supabase";
}

export function photoStore(): PhotoStore {
  return activeProvider() === "r2" ? r2PhotoStore : supabasePhotoStore;
}

const supabasePhotoStore: PhotoStore = {
  async uploadPhoto({ key, body, contentType, metadata, upsert }) {
    const supabase = await galleryDb();
    const options: { contentType: string; upsert: boolean; metadata?: Record<string, string> } = { contentType, upsert: upsert ?? false };
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
    await removeR2Objects(keys);
    await supabasePhotoStore.removePhotos(keys);
  },
  async signedGetUrls(keys, seconds = CLIENT_SIGNED_URL_SECONDS) {
    const out = new Map<string, string>();
    const missing: string[] = [];
    for (const key of [...new Set(keys)]) {
      // Presigning does not verify existence, so HEAD first and only fall back
      // to Supabase when the R2 object is genuinely absent.
      if (await headObject(key)) {
        out.set(key, await createSignedGetUrl(key, seconds));
      } else {
        missing.push(key);
      }
    }
    if (missing.length) {
      const supabaseUrls = await supabasePhotoStore.signedGetUrls(missing, seconds);
      for (const [key, url] of supabaseUrls) out.set(key, url);
    }
    return out;
  },
  async signedDownloadUrl(key, filename, seconds = DOWNLOAD_SIGNED_URL_SECONDS) {
    const supabaseUrl = await supabasePhotoStore.signedDownloadUrl(key, filename, seconds);
    if (!(await objectExists(key))) return supabaseUrl;
    return createSignedGetUrl(key, seconds, filename).catch(() => null);
  },
  async downloadBytes(key) {
    return (await downloadObjectBytes(key)) ?? (await supabasePhotoStore.downloadBytes(key));
  },
  async objectBytes(key) {
    return (await objectBytes(key)) ?? (await supabasePhotoStore.objectBytes(key));
  },
  async objectExists(key) {
    return (await objectExists(key)) || (await supabasePhotoStore.objectExists(key));
  },
};
