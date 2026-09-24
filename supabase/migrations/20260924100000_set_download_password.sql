-- Session 12: separate mandatory download PIN for each client gallery set.
-- This is intentionally independent from galleries.password_hash and
-- galleries.client_password_hash. A gallery may be completely public while
-- every downloadable set still requires its own PIN.

alter table public.folders
  add column if not exists download_password_hash text;
