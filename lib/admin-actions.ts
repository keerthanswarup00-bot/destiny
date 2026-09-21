"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { adminDb } from "@/lib/admin-data";

const ACCOUNT_MAX_ATTEMPTS = 5;
const NETWORK_MAX_ATTEMPTS = 30;
const WINDOW_MINUTES = 15;
const RATE_LIMIT_NAMESPACE = process.env.GALLERY_ACCESS_SECRET || "admin-login-rate-limit";

function hashIdentifier(value: string) {
  return createHash("sha256").update(`${RATE_LIMIT_NAMESPACE}:${value}`).digest("hex");
}

async function clientNetworkIdentifier() {
  const headerList = await headers();
  if (process.env.VERCEL === "1") {
    return headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  }
  return process.env.NODE_ENV === "development"
    ? headerList.get("x-real-ip")?.trim() || "local-development"
    : null;
}

async function rateLimitKeys(username: string) {
  const network = await clientNetworkIdentifier();
  return {
    account: hashIdentifier(`account:${username.toLowerCase()}`),
    network: network ? hashIdentifier(`network:${network}`) : null,
  };
}

export async function isRateLimited(username = "", trackAccount = false) {
  try {
    const keys = await rateLimitKeys(username);
    const db = await adminDb();
    const { data, error } = await db.rpc("check_admin_login_rate_limit", {
      p_account_key: trackAccount ? keys.account : null,
      p_network_key: keys.network,
      p_account_limit: ACCOUNT_MAX_ATTEMPTS,
      p_network_limit: NETWORK_MAX_ATTEMPTS,
      p_window_minutes: WINDOW_MINUTES,
    });
    if (error) return false;
    return data === false;
  } catch {
    return false;
  }
}

export async function wrongAdminCredentials(username = "", trackAccount = false) {
  try {
    const keys = await rateLimitKeys(username);
    const db = await adminDb();
    await db.rpc("record_admin_login_failure", {
      p_account_key: trackAccount ? keys.account : null,
      p_network_key: keys.network,
      p_window_minutes: WINDOW_MINUTES,
    });
  } catch {
    // Preserve the existing generic authentication response if rate-limit storage is unavailable.
  }
}
