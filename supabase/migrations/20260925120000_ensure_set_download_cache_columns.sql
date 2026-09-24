-- Repair migration for set-download cache metadata.
--
-- The original cached-set-download migration is already present in migration
-- history on some environments, but the live folders table may not contain
-- the columns. Keep this idempotent so it safely repairs schema drift without
-- touching existing data.
alter table public.folders
  add column if not exists download_zip_path text,
  add column if not exists download_zip_signature text,
  add column if not exists download_zip_generated_at timestamptz;

create index if not exists folders_download_zip_signature_idx
  on public.folders (download_zip_signature);
