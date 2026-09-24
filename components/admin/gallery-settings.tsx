"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Lock, Trash2 } from "lucide-react";
import { deleteGallery, updateGallery } from "@/app/admin/crud-actions";
import { CopyButton } from "@/components/admin/copy-button";
import { GalleryHighlightEditor } from "@/components/admin/gallery-highlight-editor";
import { GalleryInsights, type GalleryInsightsValue } from "@/components/admin/gallery-insights";

type GallerySettingsValue = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  clientId: string;
  clientName: string | null;
  status: string;
  passwordProtected: boolean;
  clientPasswordProtected: boolean;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button gs-save-button" disabled={pending} type="submit">
      {pending ? null : <Check size={15} strokeWidth={2} />}
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function DeleteGallerySubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button is-danger" disabled={pending} type="submit">
      {pending ? "Deleting…" : "Delete gallery"}
    </button>
  );
}

export function GallerySettings({
  gallery,
  clients,
  shareUrl,
  error,
  folders,
  photosByFolder,
  highlight,
  insights,
}: {
  gallery: GallerySettingsValue;
  clients: { id: string; name: string }[];
  shareUrl: string;
  error?: string | null;
  folders: { id: string; name: string }[];
  photosByFolder: Record<string, { id: string; filename: string; src: string; width: number | null; height: number | null }[]>;
  highlight: { id: string | null; src: string | null; crop: { x: number; y: number; zoom: number } | null };
  insights?: GalleryInsightsValue;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (confirmDelete && deleteRef.current && !deleteRef.current.open) deleteRef.current.showModal();
    else if (!confirmDelete && deleteRef.current?.open) deleteRef.current.close();
  }, [confirmDelete]);

  const published = gallery.status === "published";

  return (
    <section className="gs-page" id="gallery-settings">
      <div className="gs-shell">
        <form className="gs-main-form" action={updateGallery}>
          <input name="id" type="hidden" value={gallery.id} />
          <input name="slug" type="hidden" value={gallery.slug} />

          <header className="gs-header">
            <div className="gs-heading">
              <Link className="gs-back" href="#gallery-workspace">
                <ArrowLeft size={15} strokeWidth={1.8} /> Back to gallery
              </Link>
              <nav aria-label="Breadcrumb" className="gs-crumbs">
                <Link href="/admin/clients">Clients</Link>
                {gallery.clientId ? (
                  <Link href={`/admin/clients/${gallery.clientId}`}>{gallery.clientName ?? "Client"}</Link>
                ) : (
                  <span>{gallery.clientName ?? "Client"}</span>
                )}
                <span>{gallery.title}</span>
                <span aria-current="page">Settings</span>
              </nav>
              <h1>Gallery Settings</h1>
              <p className="gs-lede">Manage the details, access, and sharing for this gallery.</p>
            </div>
            <SaveButton />
          </header>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <section className="gs-card" id="settings-general">
            <div className="gs-card-head">
              <h2>General</h2>
              <p>Core details about this gallery.</p>
            </div>
            <div className="gs-card-body">
              <div className="gs-field">
                <label htmlFor="gs-title">Gallery name</label>
                <input defaultValue={gallery.title} id="gs-title" maxLength={200} name="title" required type="text" />
              </div>
              <div className="gs-field">
                <label htmlFor="gs-client">Client</label>
                {clients.length ? (
                  <select defaultValue={gallery.clientId} id="gs-client" name="client_id" required>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                ) : (
                  <input name="client_id" type="hidden" value={gallery.clientId} />
                )}
              </div>
              <div className="gs-field">
                <label htmlFor="gs-description">Description</label>
                <textarea defaultValue={gallery.description ?? ""} id="gs-description" maxLength={5000} name="description" rows={4} />
                <span className="hint">Optional description shown to your client on the gallery page.</span>
              </div>
            </div>
          </section>

          <section className="gs-card" id="settings-access">
            <div className="gs-card-head">
              <h2>Access</h2>
              <p>Control who can view this gallery.</p>
            </div>
            <div className="gs-card-body">
              <fieldset className="gs-status">
                <legend>Gallery status</legend>
                <div className="gs-status-options">
                  <label className={published ? "is-active" : undefined}>
                    <input defaultChecked={published} name="status" type="radio" value="published" />
                    <span className="gs-status-name">Published</span>
                    <span className="gs-status-hint">Gallery is visible to clients.</span>
                  </label>
                  <label className={gallery.status === "draft" ? "is-active" : undefined}>
                    <input defaultChecked={gallery.status === "draft"} name="status" type="radio" value="draft" />
                    <span className="gs-status-name">Hidden</span>
                    <span className="gs-status-hint">Gallery is not accessible to clients.</span>
                  </label>
                  <label className={gallery.status === "archived" ? "is-active" : undefined}>
                    <input defaultChecked={gallery.status === "archived"} name="status" type="radio" value="archived" />
                    <span className="gs-status-name">Archived</span>
                    <span className="gs-status-hint">Hidden from clients and retained for reference.</span>
                  </label>
                </div>
              </fieldset>

              <div className="gs-password">
                <label htmlFor="gs-password">Viewer password</label>
                <input
                  autoComplete="new-password"
                  id="gs-password"
                  minLength={6}
                  name="password"
                  placeholder={gallery.passwordProtected ? "Enter a new password to replace the current one" : "Optional password"}
                  type="password"
                />
                <span className="hint">Anyone with this password can browse, favourite, and download. Leave empty for open viewer access.</span>
                {gallery.passwordProtected ? (
                  <div className="gs-password-state">
                    <Lock size={13} strokeWidth={2} />
                    <span><strong>Viewer protection is on.</strong> The current password is never displayed. Enter a new password above to change it.</span>
                  </div>
                ) : null}
                {gallery.passwordProtected ? (
                  <label className="gs-clear-password">
                    <input name="clear_password" type="checkbox" />
                    <span>Remove viewer password<small>Makes the published gallery open without a viewer password.</small></span>
                  </label>
                ) : null}
              </div>

              <div className="gs-password">
                <label htmlFor="gs-client-password">Client password</label>
                <input
                  autoComplete="new-password"
                  id="gs-client-password"
                  minLength={6}
                  name="client_password"
                  placeholder={gallery.clientPasswordProtected ? "Enter a new password to replace the current one" : "Optional password"}
                  type="password"
                />
                <span className="hint">Optional. Clients who enter this password can mark and submit the official photo selection.</span>
                {gallery.clientPasswordProtected ? (
                  <div className="gs-password-state">
                    <Lock size={13} strokeWidth={2} />
                    <span><strong>Client access is on.</strong> The current password is never displayed. Enter a new password above to change it.</span>
                  </div>
                ) : null}
                {gallery.clientPasswordProtected ? (
                  <label className="gs-clear-password">
                    <input name="clear_client_password" type="checkbox" />
                    <span>Remove client password<small>Disables the official selection workflow for this gallery.</small></span>
                  </label>
                ) : null}
              </div>
            </div>
          </section>
        </form>

        <GalleryHighlightEditor
          folders={folders}
          galleryId={gallery.id}
          highlight={highlight}
          photosByFolder={photosByFolder}
        />

        <section className="gs-card" id="settings-sharing">
          <div className="gs-card-head">
            <h2>Sharing</h2>
            <p>Share this gallery with your client.</p>
          </div>
          <div className="gs-card-body">
            <label className="gs-field-label" htmlFor="gs-share-link">Share link</label>
            <div className="gs-share-row">
              <div className="gs-share-field">
                <input id="gs-share-link" readOnly value={shareUrl} />
              </div>
              <CopyButton label="Copy" text={shareUrl} />
            </div>
            <span className="hint">Share this link with your client to give them access to the gallery.</span>
            <div className="gs-share-actions">
              <Link className="admin-button is-secondary" href={shareUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={15} strokeWidth={1.8} /> Open gallery
              </Link>
            </div>
            <div className="gs-share-meta">
              <span>{gallery.passwordProtected ? <><Lock size={12} strokeWidth={2} /> A viewer password is required to open this gallery.</> : gallery.clientPasswordProtected ? <><Lock size={12} strokeWidth={2} /> Open to viewers; client access uses its own password.</> : "No password is set — the link opens directly."}</span>
              <span>{published ? "The link is live and ready to share." : "Publish the gallery when you are ready to make the link live."}</span>
            </div>
          </div>
        </section>

        {insights ? <GalleryInsights insights={insights} /> : null}

        <section className="gs-card gs-danger" id="settings-danger">
          <div className="gs-card-head">
            <h2>Danger zone</h2>
            <p>Permanent actions that affect the whole gallery.</p>
          </div>
          <div className="gs-card-body gs-danger-body">
            <div className="gs-danger-text">
              <strong>Delete gallery</strong>
              <span>Permanently delete this gallery and its photos. This cannot be undone.</span>
            </div>
            <button className="admin-button is-danger" onClick={() => setConfirmDelete(true)} type="button">
              <Trash2 size={15} strokeWidth={1.8} /> Delete gallery
            </button>
          </div>
        </section>
      </div>

      {confirmDelete ? (
        <dialog className="admin-dialog" onCancel={() => setConfirmDelete(false)} ref={deleteRef}>
          <form action={deleteGallery} onSubmit={() => setConfirmDelete(false)}>
            <h2>Delete this gallery?</h2>
            <p className="empty">This permanently removes this gallery and its photos. This cannot be undone.</p>
            <input name="id" type="hidden" value={gallery.id} />
            <menu>
              <button onClick={() => setConfirmDelete(false)} type="button">Cancel</button>
              <DeleteGallerySubmit />
            </menu>
          </form>
        </dialog>
      ) : null}
    </section>
  );
}