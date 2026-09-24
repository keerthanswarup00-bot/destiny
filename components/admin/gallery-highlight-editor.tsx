"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crop, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { setGalleryHighlight } from "@/app/admin/set-actions";
import { GalleryHighlightCropEditor } from "@/components/admin/gallery-highlight-crop-editor";

type HighlightPhoto = { id: string; filename: string; src: string; width: number | null; height: number | null };
type HighlightCrop = { x: number; y: number; zoom: number };

export function GalleryHighlightEditor({
  galleryId,
  folders,
  photosByFolder,
  highlight,
}: {
  galleryId: string;
  folders: { id: string; name: string }[];
  photosByFolder: Record<string, HighlightPhoto[]>;
  highlight: { id: string | null; src: string | null; crop: HighlightCrop | null };
}) {
  const [open, setOpen] = useState(false);
  const [openCrop, setOpenCrop] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    else if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  const totalPhotos = Object.values(photosByFolder).reduce((count, list) => count + list.length, 0);

  return (
    <section className="gh-feature" id="settings-highlight">
      <div className="gh-feature-head">
        <div className="gh-feature-kicker">
          <Sparkles size={13} strokeWidth={1.8} />
          Client gallery presentation
        </div>
        <div>
          <h2>Gallery highlight</h2>
          <p>Choose the one image that introduces this entire gallery. It is shared across every set.</p>
        </div>
      </div>

      <div className={highlight.src ? "gh-feature-main is-selected" : "gh-feature-main"}>
        <div className="gh-hero-preview">
          {highlight.src ? (
            <>
              {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Current gallery highlight" src={highlight.src} />
              <span className="gh-preview-label">Current highlight</span>
            </>
          ) : (
            <div className="gh-empty">
              <ImageIcon size={25} strokeWidth={1.3} />
              <strong>No highlight selected</strong>
              <span>Your chosen image will appear here in the 16:9 client hero.</span>
            </div>
          )}
        </div>

        <div className="gh-feature-copy">
          <div>
            <span className="gh-feature-label">ONE IMAGE · ENTIRE GALLERY</span>
            <h3>{highlight.id ? "Your gallery has a hero image." : "Give this gallery a strong opening image."}</h3>
            <p>
              Pick any photo from any set. The selected image becomes the full-width hero at the top of the client gallery, while the sets below remain independent.
            </p>
          </div>

          <div className="gh-feature-actions">
            <button className="admin-button" disabled={!totalPhotos} onClick={() => setOpen(true)} type="button">
              {highlight.id ? "Change highlight" : "Choose highlight"}
            </button>
            {highlight.id ? (
              <button className="admin-button is-secondary" onClick={() => setOpenCrop(true)} type="button">
                <Crop size={14} strokeWidth={1.8} /> Adjust crop
              </button>
            ) : null}
            {highlight.id ? (
              <form action={setGalleryHighlight} onSubmit={() => router.refresh()}>
                <input name="id" type="hidden" value={galleryId} />
                <input name="photo_id" type="hidden" value="" />
                <button className="admin-button is-secondary gh-remove" type="submit">
                  <Trash2 size={14} strokeWidth={1.8} /> Remove
                </button>
              </form>
            ) : null}
          </div>

          <div className="gh-feature-note">
            <span>16:9 hero frame</span>
            <span>Non-destructive crop</span>
            <span>Any set</span>
          </div>
        </div>
      </div>

      {openCrop && highlight.id && highlight.src ? (
        <GalleryHighlightCropEditor
          crop={highlight.crop}
          galleryId={galleryId}
          onClose={() => setOpenCrop(false)}
          photoId={highlight.id}
          url={highlight.src}
        />
      ) : null}

      {open ? (
        <dialog className="admin-dialog gh-picker-dialog" onCancel={() => setOpen(false)} ref={dialogRef}>
          <form
            action={setGalleryHighlight}
            onSubmit={() => {
              setOpen(false);
              router.refresh();
            }}
          >
            <div className="gh-dialog-head">
              <div>
                <span className="gh-feature-label">Gallery highlight</span>
                <h2>Choose the hero image</h2>
                <p className="muted">Select one photo from any set. This choice applies to the whole gallery, not an individual set.</p>
              </div>
              <button aria-label="Close" className="icon-button" onClick={() => setOpen(false)} type="button">×</button>
            </div>

            {totalPhotos ? (
              <div className="gh-picker">
                {folders.map(folder => {
                  const photos = photosByFolder[folder.id] ?? [];
                  if (!photos.length) return null;
                  return (
                    <fieldset className="gh-group" key={folder.id}>
                      <legend>{folder.name}<span>{photos.length} {photos.length === 1 ? "photo" : "photos"}</span></legend>
                      <div className="gh-picker-grid">
                        {photos.map(photo => (
                          <label className="gh-picker-option" key={photo.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={photo.filename} loading="lazy" src={photo.src} />
                            <input defaultChecked={highlight.id === photo.id} name="photo_id" type="radio" value={photo.id} />
                            <span className="gh-selected">Selected</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            ) : (
              <p className="empty">No photos in this gallery yet.</p>
            )}

            <input name="id" type="hidden" value={galleryId} />
            <menu>
              <button onClick={() => setOpen(false)} type="button">Cancel</button>
              <button className="admin-button" disabled={!totalPhotos} type="submit">Save highlight</button>
            </menu>
          </form>
        </dialog>
      ) : null}

      <style jsx>{`
        .gh-feature {
          border: 1px solid #E2E2DE;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          scroll-margin-top: 16px;
        }

        .gh-feature-head {
          display: grid;
          grid-template-columns: minmax(190px, .7fr) minmax(0, 1.3fr);
          gap: 28px;
          padding: 24px 24px 20px;
          border-bottom: 1px solid #EAEAE7;
        }

        .gh-feature-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          align-self: start;
          color: #777;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .11em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .gh-feature-head h2 {
          margin: 0;
          color: #111;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -.025em;
        }

        .gh-feature-head p {
          margin: 6px 0 0;
          max-width: 58ch;
          color: #6e6e6e;
          font-size: 12.5px;
          line-height: 1.5;
        }

        .gh-feature-main {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(260px, .75fr);
          min-height: 330px;
          background: #FAFAF8;
        }

        .gh-hero-preview {
          position: relative;
          min-height: 330px;
          overflow: hidden;
          background: #F0F0ED;
        }

        .gh-hero-preview img {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 330px;
          object-fit: cover;
        }

        .gh-preview-label {
          position: absolute;
          left: 14px;
          top: 14px;
          padding: 6px 9px;
          border: 1px solid rgba(255,255,255,.72);
          background: rgba(255,255,255,.9);
          color: #111;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .gh-empty {
          display: grid;
          min-height: 330px;
          place-items: center;
          align-content: center;
          gap: 7px;
          padding: 30px;
          text-align: center;
          color: #8a8a85;
        }

        .gh-empty strong {
          color: #333;
          font-size: 14px;
          font-weight: 600;
        }

        .gh-empty span {
          max-width: 30ch;
          font-size: 12px;
          line-height: 1.5;
        }

        .gh-feature-copy {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
          padding: 30px;
          background: #fff;
        }

        .gh-feature-label {
          display: inline-block;
          color: #8a8a85;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .11em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .gh-feature-copy h3 {
          margin: 9px 0 0;
          max-width: 25ch;
          color: #111;
          font-size: 24px;
          font-weight: 500;
          letter-spacing: -.035em;
          line-height: 1.08;
        }

        .gh-feature-copy p {
          margin: 12px 0 0;
          color: #6e6e6e;
          font-size: 13px;
          line-height: 1.6;
        }

        .gh-feature-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .gh-feature-actions form {
          margin: 0;
        }

        .gh-feature-note {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 15px;
          border-top: 1px solid #ECECE9;
          color: #777;
          font-size: 10px;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .gh-feature-note span + span::before {
          content: "•";
          margin-right: 8px;
          color: #C5C5C0;
        }

        .gh-picker-dialog {
          width: min(980px, 94vw);
        }

        .gh-picker-dialog form {
          min-width: 0;
        }

        .gh-dialog-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .gh-dialog-head h2 {
          margin: 7px 0 0;
          font-size: 21px;
          letter-spacing: -.03em;
        }

        .gh-dialog-head p {
          margin: 7px 0 0;
          max-width: 62ch;
          line-height: 1.5;
        }

        .gh-picker {
          display: grid;
          gap: 24px;
          max-height: min(62vh, 620px);
          overflow-y: auto;
          padding: 2px 4px 4px 0;
        }

        .gh-group {
          margin: 0;
          padding: 0;
          border: 0;
        }

        .gh-group legend {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          margin: 0 0 10px;
          padding: 0;
          color: #222;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .gh-group legend span {
          color: #999;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: .03em;
          text-transform: none;
        }

        .gh-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
        }

        .gh-picker-option {
          position: relative;
          display: block;
          min-width: 0;
          cursor: pointer;
          overflow: hidden;
          border: 1px solid #ddd;
          border-radius: 7px;
          background: #fafafa;
          transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
        }

        .gh-picker-option:hover {
          border-color: #999;
          transform: translateY(-1px);
        }

        .gh-picker-option img {
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          background: #eee;
        }

        .gh-picker-option input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }

        .gh-selected {
          position: absolute;
          left: 6px;
          right: 6px;
          bottom: 6px;
          display: none;
          padding: 5px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,.94);
          color: #111;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .03em;
          text-align: center;
        }

        .gh-picker-option:has(input:checked) {
          border-color: #111;
          box-shadow: 0 0 0 2px #111;
        }

        .gh-picker-option:has(input:checked) .gh-selected {
          display: block;
        }

        @media (max-width: 760px) {
          .gh-feature-head {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 20px;
          }

          .gh-feature-main {
            grid-template-columns: 1fr;
          }

          .gh-hero-preview,
          .gh-empty {
            min-height: 240px;
          }

          .gh-hero-preview img {
            min-height: 240px;
          }

          .gh-feature-copy {
            padding: 22px;
          }

          .gh-feature-copy h3 {
            font-size: 21px;
          }
        }

        @media (max-width: 640px) {
          .gh-picker-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
