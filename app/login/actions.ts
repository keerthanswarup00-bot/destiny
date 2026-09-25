"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isRateLimited, wrongAdminCredentials } from "@/lib/admin-actions";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  credentialsMatch,
  getBasicAdminCredentials,
} from "@/lib/admin-session";

export type LoginState = { error: string | null };

export async function signIn(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter a username and password." };
  }

  const stored = getBasicAdminCredentials();
  if (!stored) {
    return { error: "Administrator sign-in is not configured on the server." };
  }

  const isConfiguredAccount = username.toLowerCase() === stored.username.toLowerCase();
  if (await isRateLimited(username, isConfiguredAccount)) {
    return { error: "Too many failed attempts. Try again in a few minutes." };
  }

  if (!credentialsMatch({ username, password }, stored)) {
    await wrongAdminCredentials(username, isConfiguredAccount);
    return { error: "Incorrect administrator username or password." };
  }

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  redirect("/admin");
}