-- Website Gallery Highlight image + non-destructive normalized crop.
--
-- * highlight_photo_id: which photo from the Website Gallery set is the public
--   /gallery Highlight banner.
-- * highlight_crop: normalized { x, y, zoom } settings. x/y are 0..1 fractions
--   over the cover-fit image (what point is centered in the banner), zoom >= 1 is
--   the magnification above the no-crop cover fit. The ORIGINAL R2 object is
--   never cropped or replaced - the public and admin renderers reproduce the
--   crop with a CSS transform only.
alter table public.galleries
  add column if not exists highlight_photo_id uuid,
  add column if not exists highlight_crop jsonb
  check (highlight_crop is null or (highlight_crop ? 'x' and highlight_crop ? 'y' and highlight_crop ? 'zoom'));

alter table public.galleries
  drop constraint if exists galleries_highlight_photo_fk;
alter table public.galleries
  add constraint galleries_highlight_photo_fk
  foreign key (highlight_photo_id) references public.photos (id) on delete set null;