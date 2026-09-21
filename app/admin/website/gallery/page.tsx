import { WebsiteTabs } from "@/components/admin/website-tabs";
import { WebsiteGalleryCard } from "@/components/admin/website-gallery-card";
import { WebsiteGalleryUploader } from "@/components/admin/website-gallery-uploader";
import { CLIENT_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { adminDb } from "@/lib/admin-data";
import { websiteGalleryId } from "@/lib/site/website-gallery";
import { photoStore } from "@/lib/storage-provider";

type PhotoRow = {
  id: string;
  filename: string;
  original_path: string;
  bytes: number;
  created_at: string;
};

export default async function WebsiteGalleryPage() {
  const db = await adminDb();
  const galleryId = await websiteGalleryId(db);
  const rows: PhotoRow[] = galleryId
    ? ((await db.from("photos").select("id,filename,original_path,bytes,created_at").eq("gallery_id", galleryId).order("created_at", { ascending: false }).order("id", { ascending: false })).data ?? [])
    : [];
  const urls = rows.length
    ? await photoStore().signedGetUrls(rows.map(row => row.original_path), CLIENT_SIGNED_URL_SECONDS)
    : new Map<string, string>();
  const images = rows.flatMap(row => {
    const previewUrl = urls.get(row.original_path);
    return previewUrl ? [{ id: row.id, filename: row.filename, bytes: row.bytes, previewUrl }] : [];
  });

  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Gallery</h1>
          <p className="muted">Upload photos and they appear on the public /gallery automatically — newest first. No sets, categories or publish steps.</p>
        </div>
      </div>
      <WebsiteTabs />
      <section className="admin-panel" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <WebsiteGalleryUploader />
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Gallery images</h2>
          <span className="hint">{images.length} {images.length === 1 ? "image" : "images"} · newest first</span>
        </div>
        {images.length === 0 ? (
          <p className="placeholder">No images yet. Drop your first photograph above — it appears on the public gallery immediately.</p>
        ) : (
          <div className="photo-admin-grid">
            {images.map(image => <WebsiteGalleryCard key={image.id} {...image} />)}
          </div>
        )}
      </section>
    </div>
  );
}