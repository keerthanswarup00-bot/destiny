const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Deterministic "01 Sep 2026" date formatting.
 *
 * Uses only UTC getters and a fixed month table so the output is identical on
 * the server and in the browser — no locale data, no timezone, and no "Sept"
 * vs "Sep" style variance from Intl implementations.
 */
export function formatGalleryDate(date: string | Date): string {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}