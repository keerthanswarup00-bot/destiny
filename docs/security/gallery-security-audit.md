# Gallery Security Audit

Date: 2026-09-25

Scope: Destiny client-gallery, admin gallery APIs/actions, uploads, R2 storage, gallery access, client PIN, viewer identity, favourites, official client selection, downloads, and public share/cover routes.

This is a code-level security review of the current feat/admin-selected-toolbar branch. It is separate from the architecture/RLS design document.

## 1. Security boundary

- Admin mutations require the signed admin session and requireAdmin()/getCurrentAdmin().
- Client-gallery access is enforced server-side by the gallery access cookie.
- Viewer and client roles are encoded into a signed HMAC cookie and bound to the gallery and password fingerprint.
- Viewer email identity is separate from client access. The profile cookie is an identity token and does not grant client access.
- Official client selection requires CLIENT gallery access plus a valid profile identity.
- Gallery photos are resolved by both gallery id and photo/folder relationships.
- R2 credentials remain server-only. Browser uploads receive short-lived presigned PUT URLs for server-generated object keys.
- Client-facing derivatives are watermarked and signed; private originals are not exposed through the client download/share flow.

## 2. Upload security review

### Controls present

- Admin authentication is required before upload preparation or server fallback.
- Gallery and folder UUIDs are validated.
- Folder ownership is checked with both folder.id and folder.gallery_id.
- Allowed upload MIME declarations are limited to JPEG, PNG, WebP, and GIF.
- Maximum declared size is 15 MB.
- Storage keys are generated server-side from gallery, folder, UUID photo id, and a sanitized filename.
- Direct R2 uploads use short-lived presigned PUT URLs.
- Completion verifies the object can be read and that its byte length matches the declared upload size.
- Sharp must successfully decode/process the uploaded image before a client-visible photo row is created.
- Client derivatives are generated server-side.
- A database photo row is not created when derivative generation fails.
- Failed processing attempts clean up the uploaded object/derivatives on a best-effort basis.
- The completion action rejects a client-supplied storage key unless it exactly matches the server-derived key.

### Remaining hardening

1. Server-side content-type detection.
   - The upload path still accepts the browser-provided MIME declaration as metadata.
   - Sharp processing provides strong image validity checking, but the implementation does not explicitly compare the detected image format with the declared MIME type.
   - Recommended hardening: derive the authoritative MIME type from decoded image content and store that value instead of trusting the browser declaration.
   - Severity: Low/Medium.

2. Presigned PUT size enforcement.
   - The signed PUT URL is constrained by object key and content type, while the 15 MB limit is enforced by the server before signing and again during completion.
   - A stronger control would also enforce the maximum object size at the storage upload boundary if the R2 signing flow supports an equivalent condition.
   - Severity: Low/Medium.

3. Upload abuse/rate limiting.
   - Admin authentication is the authorization boundary, but there is no explicit per-admin upload rate or concurrency limit in the reviewed application code.
   - Recommended hardening: bound concurrent uploads and optionally add server-side abuse controls for unusually large batches.
   - Severity: Low for the current admin-only threat model.

These are hardening items, not identified cross-gallery authorization bypasses.

## 3. Admin API and server-action review

### Verified controls

- Admin-only server actions route through db(), which calls requireAdmin().
- The admin download preparation API explicitly checks getCurrentAdmin() and returns 401 when the session is absent.
- Admin session cookies are now scoped to /, so the cookie reaches both /admin and /api/admin/*.
- Sign-out clears the same root-scoped cookie.
- Gallery/folder/photo mutations consistently scope records by the parent gallery where applicable.
- Storage cleanup uses server-controlled photo-shaped keys rather than unrestricted bucket deletion.

### Hardening item

- Add explicit origin/Fetch Metadata checks to high-value state-changing custom API routes as defense in depth, especially where cookie-authenticated mutations are exposed outside Next server actions.
- Current cookies use HttpOnly + Secure in production + SameSite=Lax, which is useful defense in depth, but SameSite should not be treated as the only CSRF control for sensitive state changes.
- Severity: Low/Medium.

## 4. Gallery password and client PIN

### Verified controls

- Gallery passwords are stored as hashes, not plaintext.
- Client passwords are stored separately from viewer gallery passwords.
- Client access is represented as a signed role-bound cookie.
- A viewer identity/profile cookie does not grant client access.
- Password attempts are rate-limited per gallery and hashed request fingerprint over a 15-minute window.
- Generic failure messages avoid revealing whether a gallery exists or which credential was correct.
- Set download PIN checks are scoped to the requested gallery and folder before signing a download URL.
- Download PINs are not exposed to the client.

### Hardening item

- The current request fingerprint uses forwarded IP headers. In production this should rely on the trusted deployment/proxy boundary and should not be treated as a universal identity signal.
- Severity: Low/Medium.

## 5. Viewer identity, favourites, and client selection

### Verified controls

- Email identity is normalized and validated before profile creation.
- Profile identity is stored in a signed HttpOnly cookie.
- The profile cookie is explicitly documented as identity-only.
- Favourites are scoped by gallery, photo, and profile.
- Official client selection is a separate table and separate workflow from favourites.
- Official selection mutations require CLIENT gallery access.
- A submitted official selection becomes immutable through the application flow.
- Photo IDs are always checked against the current gallery before mutation.

### Hardening item

- Profile identification has no explicit abuse/rate limit in the reviewed code. An attacker could repeatedly submit arbitrary email addresses to create or update profile records.
- Recommended hardening: rate-limit profile creation/identity requests and add lightweight abuse controls.
- Severity: Medium for abuse/privacy protection, not an authorization bypass.

## 6. Signed URLs and R2 access

### Verified controls

- R2 credentials are server-only.
- Browser clients receive presigned upload URLs rather than R2 credentials.
- Client photo delivery uses signed GET URLs.
- Download URLs use bounded expirations.
- R2 existence checks prevent signing a current-provider URL for an object that is absent and allow legacy Supabase fallback.
- Public social cover delivery uses a controlled route and only a client-facing derivative.
- Password-protected galleries do not expose their cover through the public cover-image route.
- Shared-photo links resolve through a server-side token rather than exposing storage credentials.

### Hardening item

- Signed share tokens are deterministic per photo and intentionally function as bearer links. If the product later needs revocation or expiry, the token model should move to stored, expiring share records rather than a deterministic token.
- Severity: Product/security hardening, not a current defect if bearer sharing is intentional.

## 7. Storage orphan safety

### Verified controls

- Photo storage keys have a strict UUID-based shape.
- Orphan audits are read-only.
- Cleanup only removes keys that match the photo-key pattern and are not referenced by the database.
- Gallery/folder/photo deletion is DB-first so a failed storage deletion does not leave a live database row pointing at missing assets.
- R2 and legacy Supabase cleanup are both attempted by the R2 provider.

## 8. Current A3 result

No critical or high-severity cross-gallery authorization defect was identified in this code review.

The main follow-up security hardening items are:

1. Rate-limit profile identity creation.
2. Add defense-in-depth origin/Fetch Metadata checks to sensitive custom API mutations.
3. Make upload MIME authoritative from decoded image content.
4. Consider storage-level size enforcement for presigned uploads.
5. Bound upload abuse/concurrency.
6. Keep bearer share-token behavior explicitly documented, with expiry/revocation as a future option.

A3 should implement these hardening items in small, independently testable commits. No database schema change is required for the first hardening pass.