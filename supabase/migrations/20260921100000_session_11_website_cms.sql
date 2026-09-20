-- Session 11: Public website CMS (Home / Gallery / Contact / Branding / Appearance).
-- Reuses the existing galleries + folders + photos schema for public portfolio and
-- homepage "Selected Stories". No changes to storage providers or gallery backend logic.

-- 1) Public portfolio metadata on galleries. The existing `status` field stays the
--    source of truth for visibility; show_in_portfolio opts a gallery into the public
--    portfolio page and the homepage.
alter table public.galleries
  add column if not exists category text check (category is null or char_length(trim(category)) <= 100),
  add column if not exists location text check (location is null or char_length(trim(location)) <= 200),
  add column if not exists show_in_portfolio boolean not null default false,
  add column if not exists portfolio_sort integer not null default 0 check (portfolio_sort >= 0);

-- 2) Single-row website content tables. Each row has a fixed primary key so admin saves
--    can always upsert without surprises.
create table if not exists public.site_home (
  id text primary key check (id = 'home'),
  hero jsonb not null default '{}'::jsonb,
  what_we_document jsonb not null default '{}'::jsonb,
  stories jsonb not null default '{}'::jsonb,
  approach jsonb not null default '{}'::jsonb,
  cta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_stories (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null unique references public.galleries (id) on delete cascade,
  title text check (title is null or char_length(trim(title)) <= 200),
  category text check (category is null or char_length(trim(category)) <= 100),
  location text check (location is null or char_length(trim(location)) <= 200),
  event_date date,
  sort_order integer not null default 0 check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_contact (
  id text primary key check (id = 'contact'),
  studio_name text check (studio_name is null or char_length(trim(studio_name)) <= 200),
  email text check (email is null or char_length(trim(email)) <= 320),
  phone text check (phone is null or char_length(trim(phone)) <= 50),
  whatsapp text check (whatsapp is null or char_length(trim(whatsapp)) <= 50),
  instagram text check (instagram is null or char_length(trim(instagram)) <= 200),
  location text check (location is null or char_length(trim(location)) <= 200),
  address text check (address is null or char_length(trim(address)) <= 1000),
  hours text check (hours is null or char_length(trim(hours)) <= 500),
  heading text check (heading is null or char_length(trim(heading)) <= 200),
  description text check (description is null or char_length(trim(description)) <= 2000),
  cta_text text check (cta_text is null or char_length(trim(cta_text)) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_branding (
  id text primary key check (id = 'branding'),
  brand_name text check (brand_name is null or char_length(trim(brand_name)) <= 120),
  short_name text check (short_name is null or char_length(trim(short_name)) <= 40),
  tagline text check (tagline is null or char_length(trim(tagline)) <= 200),
  logo_path text check (logo_path is null or logo_path !~ '^/'),
  logo_mime text check (logo_mime is null or logo_mime like 'image/%'),
  light_logo_path text check (light_logo_path is null or light_logo_path !~ '^/'),
  light_logo_mime text check (light_logo_mime is null or light_logo_mime like 'image/%'),
  dark_logo_path text check (dark_logo_path is null or dark_logo_path !~ '^/'),
  dark_logo_mime text check (dark_logo_mime is null or dark_logo_mime like 'image/%'),
  favicon_path text check (favicon_path is null or favicon_path !~ '^/'),
  social_image_path text check (social_image_path is null or social_image_path !~ '^/'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_theme (
  id text primary key check (id = 'theme'),
  preset text not null default 'destiny-yellow' check (preset in ('destiny-yellow','mono','warm-ivory','soft-stone','black')),
  accent text check (accent is null or accent ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) RLS: site content is public-readable, admin-writable.
alter table public.site_home enable row level security;
alter table public.site_stories enable row level security;
alter table public.site_contact enable row level security;
alter table public.site_branding enable row level security;
alter table public.site_theme enable row level security;

create policy "public reads site home" on public.site_home for select to anon, authenticated using (true);
create policy "admin manages site home" on public.site_home for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads site stories" on public.site_stories for select to anon, authenticated using (true);
create policy "admin manages site stories" on public.site_stories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads site contact" on public.site_contact for select to anon, authenticated using (true);
create policy "admin manages site contact" on public.site_contact for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads site branding" on public.site_branding for select to anon, authenticated using (true);
create policy "admin manages site branding" on public.site_branding for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads site theme" on public.site_theme for select to anon, authenticated using (true);
create policy "admin manages site theme" on public.site_theme for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) Keep rows honest under concurrent edits.
create trigger site_home_set_updated_at before update on public.site_home for each row execute procedure public.set_updated_at();
create trigger site_stories_set_updated_at before update on public.site_stories for each row execute procedure public.set_updated_at();
create trigger site_contact_set_updated_at before update on public.site_contact for each row execute procedure public.set_updated_at();
create trigger site_branding_set_updated_at before update on public.site_branding for each row execute procedure public.set_updated_at();
create trigger site_theme_set_updated_at before update on public.site_theme for each row execute procedure public.set_updated_at();

create index if not exists site_stories_sort_order_idx on public.site_stories (sort_order, id);
create index if not exists galleries_portfolio_idx on public.galleries (show_in_portfolio, portfolio_sort, id) where show_in_portfolio = true;