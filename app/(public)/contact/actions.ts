"use server";

import { loadSiteContact } from "@/lib/site/site-content";
import { siteDb } from "@/lib/site/site-db";
import { buildEnquiryMessage, waLink } from "@/lib/site/whatsapp";

export type EnquiryResult =
  | { ok: true; waUrl: string; whatsapp: string; email: string }
  | { ok: false; errors?: Record<string, string | undefined>; general?: string };

export type EnquiryState = { result: EnquiryResult | null };

function field(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const values = {
    name: field(formData.get("name")),
    phone: field(formData.get("phone")),
    event_type: field(formData.get("event_type")),
    event_date: field(formData.get("event_date")),
    honeypot: field(formData.get("company")),
  };

  const errors: Record<string, string | undefined> = {};
  if (!values.name) errors.name = "Please tell us your name.";
  else if (values.name.length > 200) errors.name = "Name is too long.";
  if (!values.phone) errors.phone = "Please add your phone number.";
  else if (values.phone.length > 50) errors.phone = "Phone number is too long.";
  else {
    const digits = values.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) errors.phone = "That phone number doesn't look right.";
  }
  if (values.event_type.length > 100) errors.event_type = "Event type is too long.";
  if (values.event_date.length > 100) errors.event_date = "Event date is too long.";

  if (Object.keys(errors).length > 0) return { result: { ok: false, errors } };
  if (values.honeypot) return { result: { ok: false, errors: {} } };

  const contact = await loadSiteContact();

  let saved = false;
  try {
    const db = siteDb();
    const { data, error } = await db
      .from("contact_submissions")
      .insert({
        name: values.name,
        phone: values.phone,
        event_type: values.event_type || null,
        event_date: values.event_date || null,
        status: "new",
        source: "website",
      })
      .select("id")
      .single();
    saved = !error && Boolean(data);
  } catch {
    saved = false;
  }

  if (!saved) {
    return { result: { ok: false, general: "Something went wrong. Please try again or contact us directly on WhatsApp at 9108727795." } };
  }

  const message = buildEnquiryMessage({
    name: values.name,
    phone: values.phone,
    event_type: values.event_type,
    event_date: values.event_date,
  });

  return {
    result: {
      ok: true,
      waUrl: contact.whatsapp ? waLink(contact.whatsapp, message) : "",
      whatsapp: contact.whatsapp,
      email: contact.email,
    },
  };
}