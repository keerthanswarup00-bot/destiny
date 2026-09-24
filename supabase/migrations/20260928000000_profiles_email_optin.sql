-- Track whether a visitor opted in to be contacted when their email is captured.
-- Opt-in is sticky: once true it can only be cleared manually in the database.
alter table public.profiles add column if not exists marketing_optin boolean not null default false;