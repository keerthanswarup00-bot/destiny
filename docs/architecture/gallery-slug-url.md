# Gallery Slug and URL Architecture

Status: A7 complete
Branch: feat/admin-selected-toolbar
Date: 2026-09-25

## 1. Purpose

This document defines the public URL architecture for client galleries.

The goal is to keep gallery identity stable while allowing the public gallery URL to evolve safely.

## 2. Canonical identity

The gallery UUID is the permanent internal identity.
The public slug is only a routing identifier.

```
Gallery UUID  = permanent identity
Current slug  = current public URL
Slug history  = previous public URLs that redirect to the current slug
```

A slug change must never create a new gallery. It must not change the gallery's client, photos, folders, favourites, client selections, submissions, analytics, or access credentials.

## 3. Current URL

The current public gallery URL is:

`/gallery/<slug>`

The slug is stored on `galleries.slug` and is globally unique.

The database currently requires lowercase kebab-case:

`^[a-z0-9]+(?:-[a-z0-9]+)*$`

Published gallery pages resolve the gallery by slug.

## 4. Current slug generation

Gallery creation currently derives the initial slug from the gallery title.

The generated value is stored with the gallery. This gives a gallery a URL at creation time without requiring a separate URL step.

The generated slug is the initial public identifier, not the permanent identity of the gallery.

## 5. Slug normalization

All future slug generation and editing must produce the same canonical format:

- lowercase
- letters a-z
- numbers 0-9
- words separated by single hyphens
- no leading or trailing hyphen
- no consecutive hyphens
- no spaces
- no slash characters
- no query-string or fragment characters

Normalization must happen server-side before uniqueness validation.

## 6. Uniqueness

Gallery slugs are globally unique across the site. This is already enforced by the database unique constraint on `galleries.slug`.

Future slug history must follow the same global namespace. A historical slug must not be reused by another gallery while it remains a redirect target.

```
current gallery slug namespace
          +
historical redirect namespace
          =
one globally unique public gallery URL namespace
```

This prevents an old shared URL from silently opening a different gallery.

## 7. Collision handling

If two galleries request the same normalized slug, the application must not overwrite or move the existing gallery.

Preferred behavior:

1. Normalize the requested title/slug.
2. Check the slug namespace.
3. If unused, use it.
4. If occupied, generate a readable variant such as `rahul-anu-2`.
5. Re-check uniqueness server-side.
6. Store only after the database accepts the unique value.

The database remains the final authority for uniqueness.

The exact suffix policy belongs to the later Create Gallery implementation phase.

## 8. Editable current slug

A future admin workflow may allow the photographer to change the current slug.

Changing:

`/gallery/old-slug`

to:

`/gallery/new-slug`

updates only the public slug.

The gallery UUID remains unchanged.

## 9. Slug history

Editable slugs require a separate history model rather than storing previous slugs on the galleries row.

A future additive table should conceptually contain:

- id
- gallery_id
- slug
- created_at
- retired_at or equivalent state

Required integrity:

- every historical slug belongs to exactly one gallery
- a slug cannot belong to two galleries
- current and historical slugs share one global namespace
- historical rows remain immutable once used as public URLs

The exact table and constraints belong to the later URL implementation phase.

## 10. Redirect behavior

When a visitor requests an old slug:

```
/gallery/old-slug
       |
       v
slug history lookup
       |
       v
same gallery UUID
       |
       v
redirect to /gallery/new-slug
```

The redirect must never grant access by itself.

The destination URL still runs the normal gallery access rules.

An old slug therefore cannot bypass:

- gallery password protection
- client PIN protection
- viewer identity requirements
- client-selection authorization

## 11. Redirect status

Permanent slug changes should use a permanent redirect once the new slug is committed.

The implementation phase should use the framework's permanent redirect mechanism so crawlers and clients are directed to the canonical URL.

## 12. Canonical URL

The current slug is the canonical public URL.

Metadata and sharing must use:

`https://<site>/gallery/<current-slug>`

Open Graph metadata, shared gallery links, admin copy-link UI, and future sitemap entries must use the current slug.

Historical slugs should redirect rather than render duplicate gallery content.

## 13. Access-cookie interaction

Gallery access cookies are keyed by gallery UUID, not slug.

This means:

```
old URL -> same gallery UUID
new URL -> same gallery UUID
same access cookie -> same gallery access
```

A slug change therefore does not need to invalidate a valid viewer/client session.

Changing the viewer or client password remains the separate mechanism for invalidating access cookies through password-fingerprint changes.

## 14. Analytics interaction

Analytics must continue to use the gallery UUID as the stable identity.

Changing a slug must not reset:

- gallery views
- identified visitor activity
- favourites
- client selections
- submissions
- access attempts

Analytics dashboards should display the current gallery title/slug as presentation data while retaining the gallery UUID internally.

## 15. Sharing interaction

Existing shared links may contain a historical slug after a rename. Those links must resolve through slug history and redirect to the current URL.

New share links must always use the current slug.

Photo share tokens remain independent of gallery slugs and continue to use their existing server-side token model.

## 16. SEO and indexing

Only the current slug should represent the indexable gallery URL.

Historical slugs should redirect rather than render duplicate gallery content.

The current canonical URL should be used for:

- Open Graph URL
- social sharing metadata
- future canonical tags
- future sitemap entries

Password-protected/private galleries must continue to follow their existing access and indexing policy. URL architecture must not make a protected gallery public.

## 17. Reserved routes

The gallery slug namespace exists below `/gallery/`.

Future slug validation should reject values that conflict with route structure or reserved application paths if the routing architecture introduces such conflicts.

The slug must always represent one path segment. Encoded slashes, empty segments, and path traversal patterns must never be accepted as a gallery slug.

## 18. Security requirements

Every slug operation must:

1. Normalize input server-side.
2. Validate the canonical slug format server-side.
3. Enforce uniqueness in the database.
4. Resolve historical slugs only to their stored gallery UUID.
5. Never accept a browser-supplied gallery UUID as proof of ownership.
6. Keep authorization independent of the slug.
7. Preserve existing gallery access controls after redirects.
8. Prevent historical slugs from being reassigned while retained.

## 19. Failure behavior

If a slug does not exist as either a current or historical slug, the public gallery route should behave as an unavailable gallery rather than exposing database details.

Malformed slugs should not cause internal errors or unnecessary database queries.

If a slug collision occurs during an admin update, the existing gallery must remain unchanged and the admin should receive a clear validation error.

## 20. Migration strategy

A7 is architecture only. No slug-history table is introduced here.

Future implementation should be additive:

1. Preserve `galleries.id`.
2. Preserve the current `galleries.slug` column.
3. Add slug history only when editable URLs are implemented.
4. Backfill existing current slugs into the history model only if the chosen schema requires it.
5. Add global uniqueness constraints before enabling public slug edits.
6. Add redirect resolution after history data is safe.
7. Update metadata and share-link generation to use the current slug.

No existing gallery should lose its current URL during migration.

## 21. A7 result

The gallery URL architecture is now defined.

The core rule is:

```
UUID = stable gallery identity
slug = current public address
history = compatibility layer for previous addresses
```

Future slug editing can therefore be implemented without changing gallery identity, access control, analytics, or business data.
