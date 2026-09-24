-- Keep a recoverable, encrypted copy of the set download PIN for admins.
-- The download endpoint continues to verify against the existing scrypt hash.
alter table public.folders
  add column if not exists download_password_encrypted text;
