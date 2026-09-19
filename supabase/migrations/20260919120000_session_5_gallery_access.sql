-- Session 5: hashed gallery passwords (never plaintext) and faster attempt lookups.
alter table public.galleries add column if not exists password_hash text;
alter table public.galleries drop constraint if exists galleries_password_hash_not_blank;
alter table public.galleries add constraint galleries_password_hash_not_blank check (password_hash is null or char_length(password_hash) >= 32);
create index if not exists access_attempts_gallery_ip_attempted_at_idx on public.access_attempts (gallery_id, ip_hash, attempted_at desc);
