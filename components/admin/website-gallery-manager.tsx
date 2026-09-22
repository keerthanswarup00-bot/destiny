"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWebsiteGalleryImages, publishWebsiteGallery } from "@/app/admin/website/actions";
import { WebsiteGalleryCard } from "@/components/admin/website-gallery-card";
import { WebsiteGalleryHighlightEditor } from "@/components/admin/website-gallery-highlight-editor";

type Image = {
  id: string;
  filename: string;
  bytes: number;
  category: string | null;
  previewUrl: string;
};

type Highlight = {
  id: string;
  previewUrl: string;
  crop: { x: number; y: number; zoom: number } | null;
  published: boolean;
};

type CropEditor = { id: string; url: string; crop: { x: number; y: number; zoom: number } | null };

function PublishButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" disabled={pending} type="submit">{pending ? "Publishing…" : "Publish"}</button>;
}

export function WebsiteGalleryManager({ images, dirtyCount, highlight }: { images: Image[]; dirtyCount: number; highlight: Highlight | null }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [cropEditor, setCropEditor] = useState<CropEditor | null>(null);
  const allSelected = images.length > 0 && selected.length === images.length;

  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  function openCrop(image: Image) {
    setCropEditor({
      id: image.id,
      url: image.previewUrl,
      crop: image.id === highlight?.id ? highlight.crop : null,
    });
  }

  return (
    <>
      <div className="website-gallery-actions">
        {dirtyCount ? <span className="hint">{dirtyCount} unpublished {dirtyCount === 1 ? "change" : "changes"}</span> : <span className="hint">All changes published</span>}
        {dirtyCount ? <form action={publishWebsiteGallery}><PublishButton /></form> : null}
      </div>
      {highlight ? (
        <div className={`website-gallery-highlight${highlight.published ? "" : " is-unpublished"}`}>
          <p>
            Highlight: <strong>{highlight.published ? "published on /gallery" : "set but not yet published"}</strong>
            <button onClick={() => setCropEditor({ id: highlight.id, url: highlight.previewUrl, crop: highlight.crop })} type="button">Crop highlight</button>
          </p>
        </div>
      ) : null}
      {images.length ? (
        <div className="website-gallery-selection">
          <label><input checked={allSelected} onChange={event => setSelected(event.target.checked ? images.map(image => image.id) : [])} type="checkbox" /> Select all visible</label>
          {selected.length ? (
            <form action={deleteWebsiteGalleryImages} onSubmit={event => {
              if (!window.confirm(`Delete ${selected.length} ${selected.length === 1 ? "image" : "images"}?`)) event.preventDefault();
            }}>
              {selected.map(id => <input key={id} name="ids" type="hidden" value={id} />)}
              <button type="submit">Delete selected ({selected.length})</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <div className="photo-admin-grid">
        {images.map(image => (
          <WebsiteGalleryCard
            {...image}
            isHighlight={image.id === highlight?.id}
            key={image.id}
            onCrop={() => openCrop(image)}
            onSelected={() => toggle(image.id)}
            selected={selected.includes(image.id)}
          />
        ))}
      </div>
      {cropEditor ? (
        <WebsiteGalleryHighlightEditor
          crop={cropEditor.crop}
          onClose={() => setCropEditor(null)}
          photoId={cropEditor.id}
          url={cropEditor.url}
        />
      ) : null}
    </>
  );
}