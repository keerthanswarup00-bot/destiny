import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Privileged server client for public website content. Never imported from client components. */
export function siteDb() {
  return createSupabaseAdminClient();
}