import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`R2: missing required env var ${name} (values stay in .env.local; never print them)`);
  return value;
}

let client: S3Client | null = null;

/** Server-only R2 client (Cloudflare R2 S3-compatible API). Lazy, once. */
export function r2() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: required("R2_ENDPOINT"),
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export const R2_BUCKET = () => required("R2_BUCKET");

export type R2Object = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
};

export async function uploadObject({ key, body, contentType, metadata }: R2Object) {
  const command: PutObjectCommandInput = { Bucket: R2_BUCKET(), Key: key, Body: body, ContentType: contentType };
  if (metadata) command.Metadata = metadata;
  await r2().send(new PutObjectCommand(command));
}

export async function deleteObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

function isObjectMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.$metadata?.httpStatusCode === 404 ||
    e.name === "NotFound" ||
    e.name === "NoSuchKey" ||
    e.Code === "NotFound" ||
    e.Code === "NoSuchKey"
  );
}

/**
 * HEAD an object. Returns true when present, false only when the object is
 * genuinely absent (HTTP 404 / NoSuchKey). Any other R2/storage error (auth,
 * network, throttling, ...) propagates to the caller instead of being treated
 * as a miss.
 */
export async function headObject(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    return true;
  } catch (error) {
    if (isObjectMissing(error)) return false;
    throw error;
  }
}

export async function objectBytes(key: string): Promise<number | null> {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function downloadObjectBytes(key: string): Promise<Buffer | null> {
  try {
    const get = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    if (!get.Body) return null;
    return Buffer.from(await get.Body.transformToByteArray());
  } catch {
    return null;
  }
}

function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\\\r\n]/g, "").slice(0, 180);
  return `attachment; filename="${safe}"`;
}

export async function createSignedGetUrl(key: string, seconds = 60 * 60, filename?: string) {
  const command: GetObjectCommand = new GetObjectCommand({
    Bucket: R2_BUCKET(),
    Key: key,
    ...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
  });
  return getSignedUrl(r2(), command, { expiresIn: seconds });
}

export async function createSignedPutUrl(key: string, contentType: string, seconds = 10 * 60) {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: R2_BUCKET(), Key: key, ContentType: contentType }), { expiresIn: seconds });
}
