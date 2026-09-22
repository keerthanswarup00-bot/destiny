alter table public.site_branding
  add column if not exists watermark_enabled boolean not null default true,
  add column if not exists watermark_opacity double precision not null default 1,
  add column if not exists watermark_scale double precision not null default 0.12,
  add column if not exists watermark_margin double precision not null default 0.03,
  add column if not exists watermark_position text not null default 'bottom-right'
    check (watermark_position in ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'));