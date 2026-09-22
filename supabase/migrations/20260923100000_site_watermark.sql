-- Admin-managed Client Gallery watermark logo. Reuses the single-row
-- site_branding settings table (id = 'branding') and the existing image
-- path/mime convention. Null path means the watermark is OFF; uploads then
-- produce normal unwatermarked derivatives.
alter table public.site_branding
  add column if not exists watermark_path text check (watermark_path is null or watermark_path !~ '^/'),
  add column if not exists watermark_mime text check (watermark_mime is null or watermark_mime like 'image/%');