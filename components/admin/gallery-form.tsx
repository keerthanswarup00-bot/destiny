import { createGallery, updateGallery } from "@/app/admin/crud-actions";

type ClientOption = { id: string; name: string };
type GalleryValues = { id: string; title: string; slug: string; description: string | null; client_id: string; status: "draft" | "published" | "archived"; passwordProtected?: boolean };

export function GalleryForm({
  clients,
  clientId,
  gallery,
  from,
  error,
}: {
  clients?: ClientOption[];
  clientId?: string;
  gallery?: GalleryValues;
  from?: "galleries";
  error?: string | null;
}) {
  const editing = Boolean(gallery);
  return (
    <form action={editing ? updateGallery : createGallery} className="admin-panel settings-card" id="gallery-form">
      <h2>{editing ? "Edit collection" : "New collection"}</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {gallery ? <input name="id" type="hidden" value={gallery.id} /> : null}
      {from ? <input name="from" type="hidden" value={from} /> : null}
      {clients?.length ? (
        <label>Client
          <select defaultValue={gallery?.client_id ?? clientId ?? ""} name="client_id" required>
            <option disabled value="">Select a client</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
      ) : (
        <input name="client_id" type="hidden" value={gallery?.client_id ?? clientId ?? ""} />
      )}
      <label>Gallery name<input defaultValue={gallery?.title} maxLength={200} name="title" required /></label>
      {editing ? (
        <>
          <label>Description<textarea defaultValue={gallery?.description ?? ""} maxLength={5000} name="description" rows={4} /></label>
          <label>Status
            <select defaultValue={gallery?.status ?? "draft"} name="status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <input name="slug" type="hidden" value={gallery?.slug ?? ""} />
        </>
      ) : (
        <input name="status" type="hidden" value="draft" />
      )}
      <label>Gallery password{gallery?.passwordProtected ? " (currently set)" : " (optional)"}
        <input autoComplete="new-password" minLength={6} name="password" type="password" />
      </label>
      {gallery?.passwordProtected ? <label className="switch-row"><span>Remove password<small>Makes the published gallery open without a password.</small></span><input name="clear_password" type="checkbox" /></label> : null}
      <button className="admin-button">{editing ? "Save collection" : "Create Gallery"}</button>
    </form>
  );
}
