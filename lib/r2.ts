import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, type PutObjectCommandInput, type CompletedPart } from "@aws-sdk/client-s3";
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

/** List every object key in the R2 bucket (paginated ListObjectsV2). */
export async function listObjects(): Promise<string[]> {
  const bucket = R2_BUCKET();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of page.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
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


export async function uploadMultipartObject(
  key: string,
  parts: AsyncIterable<Buffer>,
  contentType: string,
) {
  const partSize = 8 * 1024 * 1024;
  let buffer = Buffer.alloc(0);
  let uploadId: string | undefined;
  const uploaded: CompletedPart[] = [];
  let partNumber = 1;

  const flush = async (force = false) => {
    while (buffer.length >= partSize || (force && buffer.length > 0)) {
      const size = buffer.length >= partSize ? partSize : buffer.length;
      const part = buffer.subarray(0, size);
      buffer = buffer.subarray(size);

      if (!uploadId) {
        const created = await r2().send(new CreateMultipartUploadCommand({
          Bucket: R2_BUCKET(),
          Key: key,
          ContentType: contentType,
        }));
        uploadId = created.UploadId;
        if (!uploadId) throw new Error("R2 multipart upload did not return an upload ID.");
      }

      const response = await r2().send(new UploadPartCommand({
        Bucket: R2_BUCKET(),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: part,
        ContentLength: part.length,
      }));
      uploaded.push({ PartNumber: partNumber, ETag: response.ETag });
      partNumber += 1;
    }
  };

  try {
    for await (const chunk of parts) {
      if (!chunk.length) continue;
      buffer = Buffer.concat([buffer, chunk]);
      await flush(false);
    }

    if (!uploadId) {
      await uploadObject({ key, body: buffer, contentType });
      return;
    }

    await flush(true);

    await r2().send(new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: uploaded },
    }));
  } catch (error) {
    if (uploadId) {
      try {
        await r2().send(new AbortMultipartUploadCommand({
          Bucket: R2_BUCKET(),
          Key: key,
          UploadId: uploadId,
        }));
      } catch {}
    }
    throw error;
  }
}
