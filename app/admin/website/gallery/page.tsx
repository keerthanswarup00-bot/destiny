import { WebsiteTabs } from "@/components/admin/website-tabs";
import { WebsiteGalleryManager } from "@/components/admin/website-gallery-manager";
import { WebsiteGalleryUploader } from "@/components/admin/website-gallery-uploader";
import { CLIENT_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { adminDb } from "@/lib/admin-data";
import { normalizeWebsiteGalleryCategory, websiteGalleryId } from "@/lib/site/website-gallery";
import { photoStore } from "@/lib/storage-provider";

type PhotoRow = {
  id: string;
  filename: string;
  original_path: string;
  bytes: number;
  created_at: string;
  category: string | null;
  published_category: string | null;
  published: boolean;
  pending_delete: boolean;
};

export default async function WebsiteGalleryPage({ searchParams }: { searchParams: Promise<{ category?: string; published?: string }> }) {
  const { category: rawCategory, published } = await searchParams;
  const category = normalizeWebsiteGalleryCategory(rawCategory);
  const db = await adminDb();
  const galleryId = await websiteGalleryId(db);
  const rows: PhotoRow[] = galleryId
    ? ((await db.from("photos").select("id,filename,original_path,bytes,category,published_category,published,pending_delete,created_at").eq("gallery_id", galleryId).order("created_at", { ascending: false }).order("id", { ascending: false })).data ?? [])
    : [];
  const dirtyCount = rows.filter(row => !row.published || row.pending_delete || row.category !== row.published_category).length;
  const visibleRows = rows.filter(row => !row.pending_delete && (!category || row.category === category));
  const urls = visibleRows.length
    ? await photoStore().signedGetUrls(visibleRows.map(row => row.original_path), CLIENT_SIGNED_URL_SECONDS)
    : new Map<string, string>();
  const images = visibleRows.flatMap(row => {
    const previewUrl = urls.get(row.original_path);
    return previewUrl     ? [{ id: row.id, filename: row.filename, bytes: row.bytes, category: row.category, previewUrl }] : [];
  });

  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Gallery</h1>
          <p className="muted">Upload photos, assign categories, and publish them to the public /gallery when ready.</p>
        </div>
      </div>
      <WebsiteTabs />
      <section className="admin-panel" style={{ padding: "18px 20px", marginBottom: 16 }}>
        {published === "1" ? <p className="form-success" role="status">Website Gallery published.</p> : null}
        <WebsiteGalleryUploader />
        <nav className="website-gallery-filters" aria-label="Website Gallery categories">
          {[["", "All"], ["wedding", "Wedding"], ["events", "Events"], ["portraits", "Portraits"], ["celebrations", "Celebrations"]].map(([value, label]) => (
            <a className={value === (category ?? "") ? "is-active" : undefined} href={value ? `/admin/website/gallery?category=${value}` : "/admin/website/gallery"} key={value}>{label}</a>
          ))}
        </nav>
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Gallery images</h2>
          <span className="hint">{images.length} {images.length === 1 ? "image" : "images"} · newest first</span>
        </div>
        <WebsiteGalleryManager dirtyCount={dirtyCount} images={images} />
        {images.length === 0 ? <p className="placeholder">No working images in this view. New uploads remain unpublished until you publish them.</p> : null}
      </section>
    </div>
  );
}