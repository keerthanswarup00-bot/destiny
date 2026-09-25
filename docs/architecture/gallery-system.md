# Gallery System Architecture

Status: A1 complete
Scope: architecture and data-model contract for the Destiny client-gallery system
Branch: feat/admin-selected-toolbar

## 1. Purpose

This document defines the data boundaries that future client-selection, feedback, analytics, and gallery-URL work must follow. It is an architecture contract, not a database migration.

The existing gallery system is retained. Future phases must extend it rather than replace working gallery, viewer, favorite, download, authentication, or storage flows.

## 2. Existing core model

The current database already has these core entities:

- `clients`: photographer-managed client records.
- `galleries`: one client-facing gallery belonging to a client.
- `folders`: sets inside a gallery; folders can be nested.
- `photos`: photos belonging to both a gallery and folder.
- `profiles`: lightweight email identity records. Email identifies a viewer/client but is not a credential.
- `selections`: existing viewer favorites. Legacy rows use `viewer_key_hash`; newer rows may use `profile_id`.
- `client_selection_photos`: official client selections, separate from favorites.
- `selection_submissions`: submission record for an official client selection.
- `gallery_views`: per-gallery visitor/view aggregation.
- `access_attempts`: gallery access audit records.
- `photo_shares`: photo-share token records.

The current gallery also owns its single highlight through `galleries.highlight_photo_id` and `galleries.highlight_crop`. Sets/folders do not own client-facing highlight images.

## 3. Canonical relationships

```
Client
  |
  +-- Gallery
       |
       +-- Folder / Set
       |    |
       |    +-- Photo
       |
       +-- Gallery Highlight -> Photo
       |
       +-- Viewer/Profile
       |    |
       |    +-- Favorites -> Photo
       |    +-- Client Selection -> Photo
       |    +-- Feedback -> Photo (future)
       |
       +-- Selection Submission
       |
       +-- Visitor/View analytics
       |
       +-- Access attempts
       |
       +-- Share tokens
```

## 4. Identity model

There are three distinct concepts:

### Anonymous visitor

A person can view a gallery without providing an email. Anonymous access is represented by the existing gallery access/session mechanisms and server-side visitor analytics.

### Identified viewer

An email can identify a person for favorites and future client workflows. The `profiles` table is intentionally lightweight. Email is identity, not authentication.

### Client

A `client` is a photographer-managed business record. A client account/profile must not be inferred merely because an email exists.

Client/Plus access is protected by the gallery's client PIN/password flow. Identity alone never grants client/Plus access.

## 5. Favorites vs Client Selection

These are permanently separate concepts.

### Favorite

Meaning:

> "I like this photo."

Current storage: `selections`.

Ownership: viewer/profile identity.

Lifecycle: can be changed freely and does not constitute a delivery request.

### Client Selection

Meaning:

> "I want this photo included in the official client selection."

Current storage: `client_selection_photos`.

Ownership: profile/client identity.

Lifecycle: can be reviewed and submitted through `selection_submissions`.

A photo may be both favorited and officially selected at the same time.

No future UI or migration should merge these concepts.

## 6. Submission model

The selection workflow is:

```
Profile
  -> client_selection_photos
  -> review
  -> selection_submissions
```

A submission is an event/state boundary, not a replacement for the selected-photo rows.

The selected-photo rows remain the source of which photos are selected. The submission records that the client formally submitted the current selection for that gallery.

The existing unique constraint of one submitted selection per gallery/profile must be preserved unless a future version explicitly introduces revisions.

## 7. Future feedback model

Feedback is not part of favorites or selection rows.

When implemented, feedback should reference:

- gallery
- photo
- profile/client identity
- message
- lifecycle status
- timestamps

Feedback should not mutate the favorite or selection state.

## 8. Future analytics model

Analytics are separate from business state.

Existing `gallery_views` records one aggregated visitor row per gallery and visitor key, with first/last viewed timestamps and a view count.

This remains suitable for gallery-level visitor counts.

Future event analytics should be additive and should not overload `gallery_views` with favorite, selection, download, share, or UI-interaction events.

Analytics must remain server-controlled and must not expose visitor keys to clients.

## 9. Gallery URL model

The gallery UUID is the canonical internal identity.

The slug is a public routing identifier.

Future editable URLs must therefore follow:

```
Gallery UUID = stable identity
Current slug  = current public URL
Slug history  = previous public URLs / redirects
```

Changing a slug must never create a new gallery or alter ownership of its photos, selections, profiles, or analytics.

A future slug-history table should be additive and unique per public slug.

## 10. Authorization boundaries

### Admin

Can manage:

- clients
- galleries
- folders
- photos
- gallery settings
- selections
- analytics
- feedback
- URL settings

### Viewer

Can:

- access a gallery according to its access rules
- identify themselves for supported viewer features
- manage their own favorites

Identity alone must not grant client/Plus access.

### Client

Can, when correctly authenticated for the gallery/client workflow:

- access client-only functionality
- create/update their own selection
- submit their selection
- create/view their own feedback

A client must not gain access to another client's gallery data.

### Anonymous visitor

Can only perform public gallery actions allowed by the gallery access policy.

## 11. Storage boundary

Database records describe gallery assets. R2/storage objects are implementation details and must not become public identity.

The database stores original/preview/thumbnail/download paths. Future upload safety work must preserve this separation.

The original photographer filename is metadata and must remain separate from generated storage object keys.

## 12. Rules for future migrations

Future migrations must:

1. Extend existing tables only when the concept genuinely belongs to that entity.
2. Prefer new tables for new concepts such as feedback, slug history, or detailed analytics events.
3. Preserve existing favorite rows and legacy viewer-key identity.
4. Preserve the distinction between viewer identity and client authorization.
5. Add foreign keys that prevent cross-gallery photo references.
6. Add unique constraints for idempotent client actions.
7. Enable RLS on every new client/gallery data table.
8. Keep service-role-only operations server-side.
9. Avoid destructive renames/removals unless a migration has a verified data transition.
10. Update `lib/supabase/database.types.ts` whenever the database schema changes.

## 13. A1 implementation boundary

A1 intentionally creates no new application tables.

The existing schema already contains the foundation needed for the next phases:

- client identity: `clients` + `profiles`
- favorites: `selections`
- official selection: `client_selection_photos` + `selection_submissions`
- gallery views: `gallery_views`
- access auditing: `access_attempts`
- photo sharing: `photo_shares`

The next schema changes should be introduced only when implementing their specific feature, after this contract is reviewed.

## 14. Next architecture checkpoints

Before implementation:

- 8D: review upload validation, duplicate handling, original filename semantics, and orphan cleanup.
- 9A: review analytics aggregation/query strategy.
- 10A/10B: review client-selection authorization and PIN/session boundaries.
- 10D: design feedback schema and RLS.
- 11A/11B: design slug-history and redirect behavior.
