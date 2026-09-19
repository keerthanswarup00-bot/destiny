# Build status

## Completed — Session 7 (production/security/performance/UX audit)

Byte-exact audit of Sessions 1–6 with `npm run typecheck`, `npm run lint`, and `npm run build` all green.

### Security

- Diagnostic dump of security invariants, byte-exact across repo + stored Supabase config: confirmed, no gaps found; no change required.
- Admin operations surfaced as server actions only; all are `"use server"` and every admin entrypoint calls `requireAdmin()` first (`app/admin/crud-actions.ts`, `app/admin/actions.ts`, `app/admin/layout.tsx`). The service-role client is created server-side only (`lib/supabase/admin.ts`) from `SUPABASE_SERVICE_ROLE_KEY`; it is never imported from client components. `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are the only public keys; no service-role/private tokens are exported on the client.
- Gallery access: `requireGalleryAccess` is enforced server-side on every protected public route and server action. Password verification is `scrypt`-based (`verifyGalleryPassword`). Success writes an HMAC-signed, HttpOnly, `SameSite=Lax`, `Secure`-in-prod cookie whose payload includes the gallery access per-gallery id, an HMAC of the password fingerprint, and an expiry; gallery A's cookie cannot authorize gallery B (cookie name + signed payload scoped to gallery id, and `readGalleryAccess` verifies `tokenGallery === galleryId`). Changing the password changes the fingerprint, invalidating old cookies. Malformed/expired/truncated cookies fail safely (return to password gate).
- Signed cookie tokens never contain plaintext passwords; only the scrypt fingerprint is embeddedholo. Passwords are verified server-side; hashes never leave the server.
- Viewer selection: viewer identity comes from an HttpOnly viewer cookie; only `viewer_key_hash` (SHA-256 of the cookie token) is stored/queried. `selections` rows are scoped by `gallery_id` + `viewer_key_hash`, so a client cannot toggle/modify another viewer's selection; photo toggle verifies the photo belongs to the authorized gallery before insert/delete. `selection_submissions` rows store `selection_session_hash`, and `submitPhotoSelection` checks for an existing submission (unique on `gallery_id` + `selection_session_hash`) to reject duplicates.
- Photo share: tokens are deterministic HMACs (`photoShareToken(photoId)`) of the photo id under `GALLERY_ACCESS_SECRET`, stored as `photo_shares.token_hash` (unique) with a `token_hash` lookup server-side. `/p/[token]` resolves only the single photo's signed URL and never calls `resolveGalleryAccess`, so a share token cannot unlock the gallery password flow for other folders/photos — even when the gallery is password-protected. Token hash hashing + RLS: `photo_shares` RLS only for admin; public reads go through the privileged server action.
- Storage: `GALLERY_ASSET_BUCKET` (gallery-assets) is private; no public policy allows direct read. All client access uses short-lived signed URLs generated server-side; `original_path` is never returned to the browser (client only receives signed derivative URLs, and grids use `thumbnail_path`/`preview_path` when present, falling back to `original_path`). Direct storage paths cannot be supplied: download/download-shared actions verify gallery + photo membership and derive the object path server-side (`clientFacingObjectPath`), not from form input.
- RLS: `public` tables and storage bucket have admin-only policies (except public gallery reads); access attempts are rate-limited (per-gallery + per-IP-hash window), recorded with `ip_hash`/`user_agent` nulled, and never returned to the browser.
- No secrets leaked: search of the tree for `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `sbp_` JWTs, anon keys, `.env` contents — none committed (git status shows no tracked secret files; only `.env.example` template). `.gitignore` excludes `.env*.local`.
- `photo_shares.token_hash`, `selections (gallery_id, photo_id, viewer_key_hash)`, `selection_submissions (gallery_id, selection_session_hash)` all have unique constraints verified in migration `20260919130000_session_6_gallery_actions.sql`.

### Performance

- Admin query for gallery detail gathers folders/photos/submissions in parallel (`Promise.all`); the photo grid loads only `thumbnail_path`/`preview_path`/`original_path`, signed in one batch; no N+1 photo loops.
- Client gallery: grid uses `clientFacingObjectPath` (grid path derived from thumbnail→preview→original) and signs a single batch of unique paths; no client-side re-fetch of signed URLs; lightbox uses the same signed `fullSrc` already fetched by the grid — no duplicate signed-URL requests.
- Signed URLs are short-lived (previews 15 min, downloads 60 s); creation is server-side and regenerated per render; no client persistence beyond the current page.
- No derivatives pipeline yet: when neither `thumbnail_path` nor `preview_path` exists, the grid falls back to the original upload (acceptable for V1, documented as a limitation). `clientFacingObjectPath` is already written to prefer future derivatives.

### UX

- Mobile/lightbox verified at 375/390/768 px: grid is responsive with explicit responsive rules, no horizontal overflow; lightbox supports swipe, fullscreen, keyboard, and touch gestures via YARL; heart/selection buttons are native with `aria-pressed`/`aria-label`.
- Empty/loading/error states present in admin (empty folder/photo messages, delete confirm dialogs) and client gallery ("This gallery does not have any folders yet.", password gate, submitted selection notice).
- Accessibility: native buttons, dialog elements for delete confirmation, `aria-label`/`aria-pressed` on selection hearts, keyboard navigation in the lightbox and dialogs, focus stays within dialog when open.

### Production readiness

- `npm run typecheck` — passes.
- `npm run lint` — passes (1 pre-existing public-hero `<img>` warning, left unchanged).
- `npm run build` — passes; all routes generated, incl. `/gallery/[slug]`, `/gallery/[slug]/[folderSlug]`, `/p/[token]` (dynamic, not static/prerendered — no shared cached private content).

### Known limitations

- No server-side derivative pipeline yet; grids serve originals when `thumbnail_path`/`preview_path` are absent. Codes are ready to prefer derivatives the moment they exist.
- Signed URLs are short-lived and regenerated per render; no client-side signed-URL caching.
- Share links are deterministic per photo (same token reused) and cannot be bulk/album-shared.
- Share links intentionally work independent of gallery passwords (token is the credential); this is by design for password-protected galleries and does not grant broader access.
- Public hero `<img>` lint warning + autoprefixer `align-items: end` warning are pre-existing and left unchanged.

## Completed — Session 6

- Full client-gallery lightbox via YARL (open from grid, previous/next, keyboard, mobile swipe, fullscreen, zoom touch, index counter).
- Lightbox custom toolbar: heart (select/unselect, stays in sync with grid), share, download, close — a single selection state powers both grid and lightbox.
- Individual photo download: server verifies gallery access + photo gallery membership, returns a short-lived signed URL; `original_path` never reaches the browser.
- Individual photo share: `ensurePhotoShareToken` reuses a deterministic HMAC token persisted in `photo_shares`; Web Share sheet or clipboard copy; works on both folder page and shared-photo page.
- Shared photo page `/p/[token]`: resolves token server-side, shows exactly one photo with minimal header + share/download; exposes no folders/grid/counts.
- Share tokens are independent of gallery passwords: the token itself is the credential, and the page never resolves gallery access, so it works for password-protected galleries without granting access to the rest of the gallery.
- Submit Selection: sticky selection bar with count, confirmation dialog, "Submitted" success view. Server action verifies viewer session + gallery access + selection ownership before writing `selection_submissions`; duplicate submissions rejected. `selections` remain the source of selected photos.
- Admin gallery view now shows submission status ("No selection" / "Selection in progress" / "Selection submitted") in the client-gallery settings card, and a "Submitted selections" panel listing each submission (status, submitted time, photo count, thumbnails, and filenames).

## Security

- All client photo queries/mutations scoped server-side to the authorized gallery id; a client-supplied gallery id is never trusted as authorization.
- Selection/submission isolation: rows keyed off a viewer hash derived from the HttpOnly viewer cookie; a viewer can only toggle/submit their own rows.
- Share-token authorization: `photoFromShareToken` looks the token hash up in `photo_shares`, returns at most one photo scoped to its gallery; `/p/[token]` never resolves gallery access. Random/modified/truncated tokens fail server-side (no match → 404).
- Download authorization: download actions re-verify gallery access and that photo belongs to that gallery before signing the URL.
- Storage bucket stays private; only short-lived server-signed URLs reach the browser.
- `original_path` is never serialized to the browser.

## Known limitations

- Preview/thumbnail derivatives not implemented; grids use signed URLs for existing stored originals. `clientFacingObjectPath` prefers `thumbnail_path`/`preview_path` when they eventually exist.
- Signed URLs expire after 15 minutes; pages re-sign on each load.
- Bulk/ZIP downloads intentionally unsupported.
- Share tokens deterministic (HMAC of photo id) so the same link is reused.
- Pre-existing lint warning: `app/(public)/page.tsx` `@next/next/no-img-element` on the public hero `<img>`. Left unchanged.
- Pre-existing Autoprefixer warning: `app/admin/admin.css` `align-items: end`. Left unchanged.

## Completed — Session 5

- Client routes: `/gallery/[slug]` and `/gallery/[slug]/[folderSlug]`.
- Optional password access: published galleries without `password_hash` open immediately; protected galleries show password screen with no folders/counts/images.
- Passwords stored as `scrypt` hashes (`galleries.password_hash`), never sent to browser.
- Gallery access cookie: HttpOnly, `Secure` in production, `SameSite=Lax`, HMAC-signed, scoped to one gallery id + password fingerprint; password change invalidates existing cookies.
- Anonymous selection uses separate HttpOnly viewer cookie; `selections.viewer_key_hash` = SHA-256 of token; toggle only succeeds for photos in authorized gallery and caller's own hash.
- Signed preview delivery: 15-min signed URLs; `clientFacingObjectPath()` prefers `thumbnail_path` → `preview_path` → `original_path`. Original paths not returned to client.
- Gallery home (title, description, folders, cover, counts), folder photo grid, heart select/unselect, sticky selected count.

## Setup required

1. Run `supabase/migrations/20260919000000_session_2_foundation.sql`, `supabase/migrations/20260919120000_session_5_gallery_access.sql`, and `supabase/migrations/20260919130000_session_6_gallery_actions.sql`.
2. Create the photographer user in Supabase Auth, then insert that UUID into `public.admin_users`.
3. Copy `.env.example` to `.env.local` and fill in URL, anon key, server-only service-role key, and `GALLERY_ACCESS_SECRET`.

## Next session

- Implement server-side derivative pipeline (thumbnail + preview) so grids never serve originals once derivatives exist.
- Add admin activity/audit logging and optional signed-URL caching/CDN for public site.
