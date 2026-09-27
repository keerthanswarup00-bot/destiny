import { NextResponse } from "next/server";
import { getSiteBranding } from "@/lib/site/site-content";
import { photoStore } from "@/lib/storage-provider";

export const dynamic = "force-dynamic";

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(request: Request) {
  try {
    const branding = await getSiteBranding();
    const path = branding.social_image_path;

    if (path) {
      const bytes = await photoStore().downloadBytes(path);
      if (bytes) {
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type": contentTypeFor(path),
            "Cache-Control": "public, max-age=300, s-maxage=3600",
          },
        });
      }
    }
  } catch {
    // Fall through to the public fallback image.
  }

  return NextResponse.redirect(new URL("/images/hero.png", request.url), 307);
}
