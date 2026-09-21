const DEFAULT_COUNTRY_CODE = "91";

export type EnquiryDetails = {
  name: string;
  email?: string;
  phone?: string;
  event_type?: string;
  event_date?: string;
  message?: string;
};

/** Normalize a phone number to an international-safe WhatsApp link number. Strips
 *  non-digits, drops leading 0 / 00, and prepends the +91 country code to bare
 *  10-digit local numbers (Indian studio default). */
export function normalizeWaNumber(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  return digits;
}

export function waLink(value: string, text?: string): string {
  const base = `https://wa.me/${normalizeWaNumber(value)}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function displayPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`.trim();
  }
  return value;
}

/** Pre-filled WhatsApp message for a contact enquiry (no internal DB ids). */
export function buildEnquiryMessage(details: EnquiryDetails): string {
  const lines = [
    "Hi Destiny Events & Photography,",
    "",
    "I would like to enquire about photography.",
    "",
    `Name: ${details.name}`,
  ];
  if (details.email?.trim()) lines.push(`Email: ${details.email.trim()}`);
  if (details.phone?.trim()) lines.push(`Phone: ${details.phone.trim()}`);
  if (details.event_type?.trim()) lines.push(`Event: ${details.event_type.trim()}`);
  if (details.event_date?.trim()) lines.push(`Event Date: ${details.event_date.trim()}`);
  if (details.message?.trim()) lines.push(...["", `Message:`, details.message.trim()]);
  lines.push(...["", "", "Sent from the Destiny website."]);
  return lines.join("\n");
}