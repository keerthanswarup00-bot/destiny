import { NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prepareSetDownload } from "@/lib/set-download";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ galleryId: string; folderId: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { galleryId, folderId } = await params;

    after(async () => {
      try {
        await prepareSetDownload(galleryId, folderId);
      } catch (error) {
        console.error("[set-download] admin preparation failed", {
          galleryId,
          folderId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return NextResponse.json({ status: "preparing" }, { status: 202 });
  } catch (error) {
    console.error("[set-download] admin request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not start set download preparation." }, { status: 500 });
  }
}
