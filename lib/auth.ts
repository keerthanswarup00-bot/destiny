import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readAdminCookie, ADMIN_SESSION_COOKIE, getBasicAdminCredentials } from "@/lib/admin-session";

export async function getCurrentAdmin() {
  const stored = getBasicAdminCredentials();
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!stored || !token || !readAdminCookie(stored.username, token)) return null;
  return { username: stored.username };
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
