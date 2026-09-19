import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Privileged server client. RLS still blocks the public anon key; this is never imported from client components. */
export function galleryDb() {
  return createSupabaseAdminClient();
}
