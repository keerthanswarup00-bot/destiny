# Gallery Security & RLS Review

Status: A2 complete
Branch: feat/admin-selected-toolbar
Reviewed: current schema and server access layer

## Security boundary

The application uses two separate authorization systems:

1. Admin application session
   - Custom signed HttpOnly cookie: `destiny_admin_session`
   - Validated by `lib/auth.ts` and `lib/admin-session.ts`
   - Cookie is scoped to `/` so both `/admin/*` and `/api/admin/*` receive it.
   - Session lifetime is 8 hours.
   - The signing secret comes from the existing server-only access-secret configuration.

2. Supabase database authorization
   - RLS is enabled on application tables.
   - `public.is_admin()` checks Supabase Auth membership in `admin_users`.
   - Server-side privileged operations use the Supabase service-role client.
   - The public/client browser must never receive the service-role key.

These systems must not be conflated. The custom admin session authorizes the application layer; the service-role database client is the privileged persistence layer.

## Reviewed RLS posture

### Admin-only data

The following are RLS-protected and admin-managed:

- `clients`
- `galleries`
- `folders`
- `photos`
- `selections`
- `photo_shares`
- `access_attempts`
- `profiles`
- `client_selection_photos`
- `selection_submissions`
- `gallery_views`

The intended policy is admin-only access through `public.is_admin()`.

### Public website data

These tables intentionally expose SELECT access to public website content:

- `site_home`
- `site_stories`
- `site_contact`
- `site_branding`
- `site_theme`

They remain admin-writable only.

This is intentional because these records power the public website. They must not contain private client-gallery information.

### Contact enquiries

`contact_submissions` intentionally permits anonymous INSERT but does not permit anonymous SELECT.

This is necessary for the public contact form, but it is an abuse/spam surface. The application layer should continue to validate submissions and should add rate limiting or another anti-abuse mechanism before treating the endpoint as production-hardened.

## Gallery access

Gallery passwords are stored as hashes, never plaintext.

The gallery access cookie:

- is HttpOnly
- uses SameSite=Lax
- is scoped to `/`
- carries a signed gallery/role payload
- distinguishes viewer and client roles

A profile email never grants client access. Client/Plus access remains PIN/password gated.

## Storage

### Supabase Storage

The legacy `client-gallery-assets` bucket is private.

Its storage policy is admin-only.

Client-facing media is delivered through signed URLs rather than a public bucket.

### Cloudflare R2

The current R2 implementation is server-only.

R2 credentials are read only from server environment variables.

Direct browser uploads receive short-lived presigned PUT URLs generated server-side. The browser does not receive R2 credentials.

R2 GET URLs are signed and time-limited.

## Upload authorization

The upload completion path performs the important server-side checks:

- current admin session is required
- gallery/folder relationship is verified
- the prepared photo ID is checked
- the submitted storage key must exactly match the server-generated key
- the stored object is read back before creating the photo record
- byte count is verified
- derivatives are generated server-side
- the database photo row is created only after processing succeeds
- failed processing attempts clean up uploaded objects on a best-effort basis

The client must never be trusted to choose its own R2 object key.

## Cross-gallery isolation

The schema uses composite foreign keys where a photo must belong to the same gallery as its parent record.

Important examples:

- folder -> gallery
- photo -> gallery + folder
- selection -> gallery + photo
- client selection -> gallery + photo
- photo share -> gallery + photo

Application queries also constrain IDs by gallery where relevant.

Future tables referencing photos should preserve this same cross-gallery protection.

## Visitor analytics

`gallery_views` is admin-only.

The visitor key is server-generated and is not returned to the browser.

The `record_gallery_view` database function:

- is SECURITY DEFINER
- uses a fixed `public` search path
- is revoked from PUBLIC
- is executable only by `service_role`

This keeps visitor identifiers and write access out of the client.

## Email/profile privacy

`profiles` contains email addresses.

It has RLS enabled and an admin-only policy.

The email should not be returned through public gallery queries, public website APIs, signed media URLs, or client-side props unless a future feature explicitly requires it.

## Findings

### No blocking RLS defect identified

The reviewed gallery/client tables have an explicit RLS posture and the server architecture keeps privileged database access server-side.

### Production hardening item: contact-form abuse

Anonymous INSERT into `contact_submissions` is intentional, but the database policy alone cannot prevent automated spam.

Recommended future hardening:

1. server-side rate limit
2. request-size limits
3. abuse logging
4. optional CAPTCHA/Turnstile if spam becomes material

This should be implemented as a dedicated contact-security task, not mixed into gallery authorization.

### Production hardening item: service-role environment

`adminDb()` prefers the Supabase service-role client when `SUPABASE_SERVICE_ROLE_KEY` is configured and otherwise falls back to the server client.

Production deployments must keep the service-role key configured. The fallback is useful for environments where Supabase Auth is the intended authorization layer, but the current custom admin-cookie system does not itself create a Supabase Auth session.

### Production hardening item: R2 error handling

R2 existence checks currently treat storage errors as a missing object in one cached path. This can turn transient R2/auth/network errors into a Supabase fallback.

This is operationally useful for legacy Supabase objects but should be revisited during upload safety work so genuine storage authorization failures are distinguishable from a 404.

## Rules for future phases

- Never expose service-role credentials.
- Never make client-gallery storage buckets public.
- Never trust gallery, folder, photo, profile, or storage IDs supplied by the browser without server-side ownership checks.
- Keep viewer identity separate from client authorization.
- Keep favorites separate from official client selections.
- Keep private emails server/admin-only.
- Add RLS to every new private table.
- Revoke public execution for service-only database functions.
- Use fixed search paths for SECURITY DEFINER functions.
- Prefer idempotent constraints for client actions.
- Do not weaken existing RLS to make a client feature easier to implement.

## A2 result

A2 is a security review and architecture checkpoint. No schema change is required at this stage.

The next feature-specific security changes should be made alongside the feature that needs them, with particular attention to 8D upload safety and 10B client selection authorization.
