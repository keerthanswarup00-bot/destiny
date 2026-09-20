import "server-only";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type AttemptEntry = { count: number; resetAt: number };

const attempts = new Map<string, AttemptEntry>();

export async function wrongAdminCredentials(username = "") {
  const key = username.toLowerCase();
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function isRateLimited(username = "") {
  const entry = attempts.get(username.toLowerCase());
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    attempts.delete(username.toLowerCase());
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}