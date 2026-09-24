import "server-only";
import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 32;

export async function hashGalleryPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyGalleryPassword(password: string, stored: string) {
  const [scheme, saltValue, hashValue] = stored.split(":");
  if (scheme !== "scrypt" || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64");
  const expected = Buffer.from(hashValue, "base64");
  if (!salt.length || expected.length !== KEY_LENGTH) return false;
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}


import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { accessSecret } from "@/lib/gallery-cookie";

function pinKey() {
  return createHash("sha256").update(accessSecret()).digest();
}

/** Encrypt a download PIN so admins can recover the exact value without storing it in plaintext. */
export function encryptDownloadPin(pin: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pinKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptDownloadPin(value: string | null | undefined) {
  if (!value) return null;
  const [version, ivValue, tagValue, cipherValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !cipherValue) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", pinKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(cipherValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
