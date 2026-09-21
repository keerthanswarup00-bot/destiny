-- Session 13: Contact form collects name, phone, event type and event date only.
-- Email and message are no longer collected, so they become optional in the DB.
-- Phone is now required for every submission.

alter table public.contact_submissions
  alter column email drop not null;

alter table public.contact_submissions
  drop constraint if exists contact_submissions_email_check;

alter table public.contact_submissions
  alter column phone set not null;