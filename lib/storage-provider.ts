import "server-only";
import { galleryDb } from "@/lib/gallery-db";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";
import { CLIENT_SIGNED_URL_SECONDS, DOWNLOAD_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { downloadObjectBytes, deleteObject, objectBytes, objectExists, uploadObject, createSignedGetUrl, headObject, listObjects } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const R2_DELETE_CONCURRENCY = 8;
const SUPABASE_REMOVE_BATCH = 50;
const SUPABASE_REMOVE_CONCURRENCY = 4;
const MAX_REMOVE_ERRORS = 8;

/** Throw one aggregated error describing all failed removals (best effort). */
async function aggregateErrors(failures: { key: string; error: unknown }[]) {
  if (!failures.length) return;
  const details = failures.slice(0, MAX_REMOVE_ERRORS).map(failure => `${failure.key}: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
  throw new Error(`storage-remove-failed (${details.length} of ${failures.length}): ${details.join("; ")}`);
}

/**
 * Delete the exact keys from R2 with bounded concurrency. Every key is
 * attempted even when some fail; a missing object is an idempotent success
 * (S3 DeleteObject semantics). Real failures are aggregated and thrown once
 * all keys have been tried so the caller can report that cleanup failed
 * without losing the remaining keys.
 */
async function removeR2Objects(keys: string[]) {
  const pending = [...new Set(keys.filter(Boolean))];
  if (!pending.length) return;
  const failures: { key: string; error: unknown }[] = [];
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const key = pending[next++];
      try {
        await deleteObject(key);
      } catch (error) {
        failures.push({ key, error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(R2_DELETE_CONCURRENCY, pending.length) }, () => worker()));
  await aggregateErrors(failures);
}

/** Delete the exact keys from the Supabase bucket, deduped and batched. */
async function removeSupabaseObjects(keys: string[]) {
  const pending = [...new Set(keys.filter(Boolean))];
  if (!pending.length) return;
  const supabase = await galleryDb();
  const failures: { key: string; error: unknown }[] = [];
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const batch = pending.slice(next, next + SUPABASE_REMOVE_BATCH);
      next += batch.length;
      try {
        const bucket = supabase.storage.from(GALLERY_ASSET_BUCKET);
        const { error } = await bucket.remove(batch);
        if (error) throw error;
      } catch (error) {
        for (const key of batch) failures.push({ key, error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SUPABASE_REMOVE_CONCURRENCY, Math.ceil(pending.length / SUPABASE_REMOVE_BATCH)) }, () => worker()));
  await aggregateErrors(failures);
}

export type PhotoStore = {
  uploadPhoto(opts: { key: string; body: Buffer; contentType: string; metadata?: Record<string, string>; upsert?: boolean }): Promise<void>;
  removePhotos(keys: string[]): Promise<void>;
  signedGetUrls(keys: string[], seconds?: number): Promise<Map<string, string>>;
  signedDownloadUrl(key: string, filename: string, seconds?: number): Promise<string | null>;
  downloadBytes(key: string): Promise<Buffer | null>;
  objectBytes(key: string): Promise<number | null>;
  objectExists(key: string): Promise<boolean>;
  listKeys(): Promise<string[]>;
  uploadStream?(opts: { key: string; parts: AsyncIterable<Buffer>; contentType: string }): Promise<void>;
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
    await removeSupabaseObjects(keys);
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
  async listKeys() {
    const supabase = await galleryDb();
    const bucket = supabase.storage.from(GALLERY_ASSET_BUCKET);
    const out: string[] = [];
    async function walk(prefix: string, depth: number) {
      if (depth > 6) return;
      for (let offset = 0; ;) {
        const { data, error } = await bucket.list(prefix, { limit: 100, offset });
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.id === null) {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            await walk(folderPath, depth + 1);
          } else {
            const key = prefix ? `${prefix}/${item.name}` : item.name;
            out.push(key);
          }
        }
        if ((data?.length ?? 0) < 100) break;
        offset += data?.length ?? 0;
      }
    }
    await walk("", 0);
    return out;
  },
};

const R2_HEAD_CONCURRENCY = 8;
const r2ExistenceCache = new Map<string, boolean>();

async function checkR2ObjectsExistence(keys: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const toCheck = keys.filter(k => !r2ExistenceCache.has(k));
  if (toCheck.length) {
    let next = 0;
    const worker = async () => {
      while (next < toCheck.length) {
        const key = toCheck[next++];
        try {
          const exists = await headObject(key);
          r2ExistenceCache.set(key, exists);
        } catch {
          r2ExistenceCache.set(key, false);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(R2_HEAD_CONCURRENCY, toCheck.length) }, () => worker())
    );
  }
  for (const key of keys) {
    results.set(key, r2ExistenceCache.get(key) ?? false);
  }
  return results;
}

const r2PhotoStore: PhotoStore = {
  uploadPhoto({ key, body, contentType, metadata }) {
    r2ExistenceCache.set(key, true);
    return uploadObject({ key, body, contentType, metadata });
  },
  async uploadStream({ key, parts, contentType }) {
    const { uploadMultipartObject } = await import("@/lib/r2");
    await uploadMultipartObject(key, parts, contentType);
    r2ExistenceCache.set(key, true);
  },
  async removePhotos(keys) {
    for (const key of keys) r2ExistenceCache.set(key, false);
    // R2 is authoritative, but legacy copies may also live in the Supabase
    // bucket (the pre-R2 upload path / provider switch). Attempt BOTH stores
    // and report the failure only after each has tried every key, so no
    // object is left behind because the first store errored.
    const failures: { key: string; error: unknown }[] = [];
    try {
      await removeR2Objects(keys);
    } catch (error) {
      failures.push({ key: "<r2>", error });
    }
    try {
      await removeSupabaseObjects(keys);
    } catch (error) {
      failures.push({ key: "<supabase>", error });
    }
    await aggregateErrors(failures);
  },
  async signedGetUrls(keys, seconds = CLIENT_SIGNED_URL_SECONDS) {
    const out = new Map<string, string>();
    const unique = [...new Set(keys.filter(Boolean))];
    if (!unique.length) return out;

    // Verify presence before presigning. R2 hosts current client derivatives;
    // anything absent there is a legacy object that only exists in the Supabase
    // bucket (pre-R2 uploads) and must fall back to Supabase — otherwise it
    // gets an R2-signed URL for an object that is genuinely absent. Existence
    // checks use bounded concurrency and a module cache, so repeated loads
    // perform no per-photo HEAD requests.
    const existence = await checkR2ObjectsExistence(unique);
    const r2KeysToSign: string[] = [];
    const missing: string[] = [];

    for (const key of unique) {
      if (existence.get(key)) {
        r2KeysToSign.push(key);
      } else {
        missing.push(key);
      }
    }

    if (r2KeysToSign.length) {
      await Promise.all(
        r2KeysToSign.map(async key => {
          out.set(key, await createSignedGetUrl(key, seconds));
        })
      );
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
  async listKeys() {
    return listObjects();
  },
};
