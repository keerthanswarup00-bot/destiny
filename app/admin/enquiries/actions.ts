"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");

async function db() {
  await requireAdmin();
  return adminDb();
}

const STATUSES = ["new", "contacted", "closed"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateEnquiryStatus(form: FormData) {
  const id = value(form, "id");
  const status = value(form, "status");
  if (!UUID_RE.test(id) || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return redirect(`/admin/enquiries${id ? `/${id}` : ""}?error=invalid`);
  }
  const supabase = await db();
  await supabase.from("contact_submissions").update({ status: status as (typeof STATUSES)[number] }).eq("id", id);
  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
  redirect(`/admin/enquiries/${id}?saved=1`);
}