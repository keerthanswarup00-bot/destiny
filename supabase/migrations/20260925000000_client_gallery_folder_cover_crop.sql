-- Client Gallery Set cover + non-destructive normalized crop.
--
-- * cover_photo_id: which photo from the Set is the cover shown on the client
--   gallery's full-screen hero and set thumbnails.
-- * cover_crop: normalized { x, y, zoom } settings. x/y are 0..1 fractions
--   over the cover-fit image (what point is centered in the hero), zoom >= 1
--   is the magnification above the no-crop cover fit. The ORIGINAL photo is
--   never cropped or replaced - the client hero reproduces the crop with a CSS
--   transform only, exactly like galleries.highlight_crop for the website
--   gallery highlight.
alter table public.folders
  add column if not exists cover_crop jsonb
  check (cover_crop is null or (cover_crop ? 'x' and cover_crop ? 'y' and cover_crop ? 'zoom'));