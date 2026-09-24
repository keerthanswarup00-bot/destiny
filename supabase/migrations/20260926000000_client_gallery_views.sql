-- Client gallery visitor analytics.
--
-- ONE row per (gallery, visitor). A "gallery view" is one visit to the gallery
-- overview page load; set switches, lightbox opening, favourites/downloads and
-- shares are never recorded here (the client never calls back per-interaction).
--
-- visitor_key is a stable server-side fingerprint:
--   identified visitor  -> "profile:<uuid>"
--   anonymous visitor   -> "ip:<sha256(x-forwarded-for)>"
-- It is never exposed to the client; this table is admin-only via RLS.
create table if not exists public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  visitor_key text not null check (char_length(visitor_key) between 8 and 300),
  view_count integer not null default 1 check (view_count > 0),
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (gallery_id, visitor_key)
);
create index if not exists gallery_views_gallery_id_idx on public.gallery_views (gallery_id, last_viewed_at desc);
alter table public.gallery_views enable row level security;
create policy "admin manages gallery views" on public.gallery_views
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Single-call upsert-with-increment for serverless page loads. Service-role
-- only; the client never calls it and the table itself is admin-read.
create or replace function public.record_gallery_view(p_gallery_id uuid, p_visitor_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gallery_views (gallery_id, visitor_key, view_count, last_viewed_at)
  values (p_gallery_id, p_visitor_key, 1, now())
  on conflict (gallery_id, visitor_key) do update
    set view_count = public.gallery_views.view_count + 1,
        last_viewed_at = now();
end;
$$;

revoke all on function public.record_gallery_view(uuid, text) from public;
grant execute on function public.record_gallery_view(uuid, text) to service_role;