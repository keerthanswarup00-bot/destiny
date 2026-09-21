"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWebsiteGalleryImages, publishWebsiteGallery } from "@/app/admin/website/actions";
import { WebsiteGalleryCard } from "@/components/admin/website-gallery-card";

type Image = {
  id: string;
  filename: string;
  bytes: number;
  category: string | null;
  previewUrl: string;
};

function PublishButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" disabled={pending} type="submit">{pending ? "Publishing…" : "Publish"}</button>;
}

export function WebsiteGalleryManager({ images, dirtyCount }: { images: Image[]; dirtyCount: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = images.length > 0 && selected.length === images.length;

  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  return (
    <>
      <div className="website-gallery-actions">
        {dirtyCount ? <span className="hint">{dirtyCount} unpublished {dirtyCount === 1 ? "change" : "changes"}</span> : <span className="hint">All changes published</span>}
        {dirtyCount ? <form action={publishWebsiteGallery}><PublishButton /></form> : null}
      </div>
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
            key={image.id}
            onSelected={() => toggle(image.id)}
            selected={selected.includes(image.id)}
          />
        ))}
      </div>
    </>
  );
}
