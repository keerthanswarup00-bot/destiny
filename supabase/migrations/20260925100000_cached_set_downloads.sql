-- Cache-ready ZIP metadata for client gallery set downloads.
alter table public.folders
  add column if not exists download_zip_path text,
  add column if not exists download_zip_signature text,
  add column if not exists download_zip_generated_at timestamptz;

create index if not exists folders_download_zip_signature_idx
  on public.folders (download_zip_signature);
