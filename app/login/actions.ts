"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export type LoginState = { error: string | null };
export async function signIn(_: LoginState, formData: FormData): Promise<LoginState> { const email = String(formData.get("email") ?? "").trim(); const password = String(formData.get("password") ?? ""); const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) return { error: "Unable to sign in with those credentials." }; redirect("/admin"); }
