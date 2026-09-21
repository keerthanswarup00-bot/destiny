-- Session 12: Public contact enquiries (WhatsApp contact system).
-- Stores visitor contact-form submissions. Visitors INSERT through the intended
-- server-side mechanism only; the table is not publicly readable. Admins manage
-- rows via the existing is_admin() posture. No email notification system.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 320),
  phone text check (phone is null or char_length(trim(phone)) <= 50),
  event_type text check (event_type is null or char_length(trim(event_type)) <= 100),
  event_date text check (event_date is null or char_length(trim(event_date)) <= 100),
  message text check (message is null or char_length(trim(message)) <= 5000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  source text not null default 'website' check (source = 'website'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Visitors may submit their own enquiry (insert only, never read others).
create policy "visitors submit website enquiries" on public.contact_submissions
  for insert to anon, authenticated with check (true);

-- Admins read, update (mark contacted/closed), and tidy rows.
create policy "admin manages contact enquiries" on public.contact_submissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index contact_submissions_created_at_idx on public.contact_submissions (created_at desc);
create index contact_submissions_status_idx on public.contact_submissions (status);

create trigger contact_submissions_set_updated_at before update on public.contact_submissions
  for each row execute procedure public.set_updated_at();