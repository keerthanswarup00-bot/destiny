-- Session 9: client fields (name, phone, event date, notes) + admin writes via
-- the signed admin cookie (service-role client) instead of Supabase Auth.
alter table public.clients drop column email;
alter table public.clients add column event_date date;
alter table public.clients alter column created_by drop not null;
alter table public.clients alter column created_by set default null;
alter table public.galleries alter column created_by drop not null;
alter table public.galleries alter column created_by set default null;
alter table public.photo_shares alter column created_by drop not null;
alter table public.photo_shares alter column created_by set default null;