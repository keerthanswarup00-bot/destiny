import Link from "next/link";
import { Plus } from "lucide-react";
import { GalleryForm } from "@/components/admin/gallery-form";
import { GalleriesView } from "@/components/admin/galleries-view";
import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";
import { galleryOverviews } from "@/lib/gallery-data";

const FILTERS = ["all", "draft", "published", "archived"] as const;
type Filter = (typeof FILTERS)[number];

export default async function Galleries({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { error, status } = await searchParams;
  const filter: Filter | null = (FILTERS as readonly string[]).includes(status ?? "") ? (status as Filter) : null;
  const db = await adminDb();

  let query = db.from("galleries").select("id,title,status,client_id,created_at,password_hash").order("created_at", { ascending: false });
  if (filter && filter !== "all") query = query.eq("status", filter);
  const { data: galleries } = await query;

  const [{ data: clients }, overviews] = await Promise.all([
    db.from("clients").select("id,name").order("name"),
    galleryOverviews(galleries?.map(gallery => gallery.id) ?? []),
  ]);
  const clientNames = new Map((clients ?? []).map(client => [client.id, client.name]));

  const items = (galleries ?? []).map(gallery => {
    const overview = overviews.get(gallery.id);
    return {
      id: gallery.id,
      title: gallery.title,
      status: gallery.status,
      clientName: clientNames.get(gallery.client_id) ?? null,
      createdAt: gallery.created_at,
      setCount: overview?.setCount ?? 0,
      photoCount: overview?.photoCount ?? 0,
      coverUrl: overview?.coverUrl ?? null,
      hasPassword: Boolean(gallery.password_hash),
    };
  });

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">COLLECTIONS</p>
          <h1>Collections</h1>
        </div>
        <div className="collections-actions">
          <Link className="admin-button is-secondary" href="/admin/clients#client-form">New Client</Link>
          <a className="admin-button" href="#gallery-form">
            <Plus size={16} strokeWidth={2} /> New Collection
          </a>
        </div>
      </div>
      {clients?.length ? (
        <GalleryForm clients={clients} error={adminError(error)} from="galleries" />
      ) : (
        <div className="admin-panel settings-card">
          <h2>Create Client Gallery</h2>
          <p className="empty">Create a client first, then add their gallery and upload photos.</p>
          <Link className="admin-button" href="/admin/clients#client-form">New Client</Link>
        </div>
      )}
      <div className="admin-tabs">
        {FILTERS.map(tab => {
          const active = tab === "all" ? !filter || filter === "all" : filter === tab;
          return (
            <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} href={tab === "all" ? "/admin/galleries" : `/admin/galleries?status=${tab}`} key={tab}>
              {tab}
            </Link>
          );
        })}
      </div>
      <GalleriesView items={items} />
    </section>
  );
}