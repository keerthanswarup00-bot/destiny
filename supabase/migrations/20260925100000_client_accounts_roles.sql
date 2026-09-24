-- Client profiles (lightweight, no auth) + viewer/client PIN roles.
--
-- Identity model: a lightweight PROFILE created from an email address. The
-- email is never a credential — it only identifies the person. Favourites,
-- the official client selection and submissions are keyed by profile_id +
-- gallery_id, not by Supabase Auth, magic links, OTP, or browser cookies.
--
-- Roles (viewer PIN vs client/Plus PIN) stay password-gated and are delivered
-- through the existing signed session cookie (lib/gallery-access.ts). Identity
-- never grants Plus access; Plus access requires the correct client PIN.

-- 1) Optional client/Plus access password, distinct from the viewer PIN. The
--    existing password_hash remains the VIEWER pin, so any gallery that already
--    has a password behaves exactly as before. A gallery with ONLY a client
--    password stays open to viewers and asks for the Plus PIN in-gallery.
alter table public.galleries add column if not exists client_password_hash text;
alter table public.galleries drop constraint if exists galleries_client_password_hash_not_blank;
alter table public.galleries add constraint galleries_client_password_hash_not_blank
  check (client_password_hash is null or char_length(client_password_hash) >= 32);

-- 2) Lightweight identity records. One row per normalized email. No password,
--    no verification, no Supabase Auth. created_at/updated_at maintained by the
--    app (service role), RLS only lets admins (or the bypassing service role)
--    touch these.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
alter table public.profiles enable row level security;
create policy "admin manages profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) Official client selections are keyed by profile_id. This table has NOT been
--    applied anywhere yet; the earlier drafts (selection_session_hash / user_id
--    keying) must not exist in any target database.
create table if not exists public.client_selection_photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  photo_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gallery_id, photo_id, profile_id),
  foreign key (photo_id, gallery_id) references public.photos (id, gallery_id) on delete cascade
);
create index if not exists client_selection_photos_gallery_id_profile_idx
  on public.client_selection_photos (gallery_id, profile_id);
alter table public.client_selection_photos enable row level security;
create policy "admin manages client selections" on public.client_selection_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) Favourites: existing rows stay keyed by viewer_key_hash (legacy cookie
--    identity) and are preserved untouched. New rows are keyed by profile_id.
--    viewer_key_hash becomes nullable so new-system rows can omit it. The old
--    unique (gallery_id, photo_id, viewer_key_hash) stays; a new unique on
--    (gallery_id, photo_id, profile_id) backs the app's upserts.
--    Legacy rows are never blindly reassigned to a profile: only a deterministic
--    per-email claim (see lib/gallery-profile.ts claimLegacyProfileRows) adopts
--    a row when its hash resolves to the SAME email a profile was created from.
alter table public.selections add column if not exists profile_id uuid references public.profiles (id) on delete cascade;
alter table public.selections alter column viewer_key_hash drop not null;
alter table public.selections add constraint selections_profile_gallery_photo_unique unique (gallery_id, photo_id, profile_id);

-- 5) Submitted selections associate the client profile. Legacy rows keep
--    selection_session_hash; the column becomes nullable and a new unique
--    (gallery_id, profile_id) enforces one submission per profile per gallery
--    for new rows.
alter table public.selection_submissions add column if not exists profile_id uuid references public.profiles (id) on delete cascade;
alter table public.selection_submissions alter column selection_session_hash drop not null;
alter table public.selection_submissions add constraint selection_submissions_profile_gallery_unique unique (gallery_id, profile_id);