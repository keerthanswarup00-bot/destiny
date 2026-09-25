# Client Selection Architecture

Status: A4 complete
Branch: feat/admin-selected-toolbar
Date: 2026-09-25

## 1. Purpose

This document defines the client-selection architecture before further UI or workflow expansion.

Client selection means:

> "These are the photographs I want included in the official selection sent to the photographer."

It is permanently separate from favourites.

## 2. Identity and authorization

Client selection uses two independent checks:

1. **Identity**
   - The viewer identifies with an email address.
   - The email creates or resolves a lightweight `profiles` row.
   - The browser receives a signed HttpOnly profile cookie.
   - Profile identity does not grant client access.

2. **Client authorization**
   - A gallery may have a separate `client_password_hash`.
   - Correct client PIN/password creates a signed gallery access cookie with role `client`.
   - `requireClientGalleryAccess()` verifies that role server-side.
   - A viewer with only profile identity cannot create official client selections.

Therefore:

```
email identity + client gallery access = official client-selection capability
email identity alone               = favourites / identity only
```

## 3. Canonical data model

The existing database model is retained:

```
Gallery
  |
  +-- Photo
  |
  +-- Profile
        |
        +-- client_selection_photos
        |       |
        |       +-- Photo
        |
        +-- selection_submissions
```

### client_selection_photos

Source of truth for the photographs currently selected by the client.

Key fields:

- `gallery_id`
- `photo_id`
- `profile_id`
- `created_at`

Required integrity:

- `photo_id + gallery_id` must reference the same gallery.
- `profile_id` identifies the client/viewer.
- `unique(gallery_id, photo_id, profile_id)` prevents duplicates.

### selection_submissions

Submission boundary.

It records that the current official selection was formally sent.

Key fields:

- `gallery_id`
- `profile_id`
- `photo_count`
- `status`
- `submitted_at`

The existing unique gallery/profile submission constraint means one official submission exists per gallery/profile in the current model.

The submission does not replace the selected-photo rows.

## 4. State machine

The intended lifecycle is:

```
CLIENT ACCESS
     |
     v
No selection
     |
     | select photos
     v
Draft selection
     |
     | review / modify
     |
     +------> clear selection
     |
     | submit
     v
Submitted
     |
     v
Locked
```

### Draft

The client can:

- add photos
- remove photos
- review selected photos
- clear the selection
- download selected photos where supported

### Submitted

Once submitted:

- the selection is recorded in `selection_submissions`
- the application treats the official selection as immutable
- further add/remove/clear operations are rejected server-side
- the photographer can review the submitted selection in admin

The server, not the UI, is the authority for the submitted/locked state.

## 5. Server authorization rules

Every official selection mutation must:

1. Resolve the gallery from the public slug.
2. Require CLIENT gallery access.
3. Resolve the current profile from the signed profile cookie.
4. Verify the target photo belongs to the same gallery.
5. Check whether a submission already exists.
6. Reject mutations after submission.
7. Perform the mutation using gallery + photo + profile constraints.

This applies to:

- add photo
- remove photo
- clear draft selection
- submit selection

The client must never be trusted to supply a gallery/photo relationship that the server has not verified.

## 6. Favorites remain separate

Favorites use the existing `selections` table.

Official client selection uses `client_selection_photos`.

They must never be merged.

A photo can therefore be:

```
favorite only
client selection only
both
neither
```

Submitting a client selection must not freeze or alter favourites.

Clearing favourites must not clear the official client selection.

## 7. Current client flow

The current UI already follows the intended boundary:

```
Client PIN
   -> CLIENT role
   -> email identity
   -> select photos
   -> review selection
   -> submit selection
   -> admin sees submission
```

Current components:

- `selection-bar.tsx`: selection count, clear, review, download, submit
- `selection-review.tsx`: review selected photos and submit
- `home-selection-bar.tsx`: gallery-level selection bar
- `selection-submissions.tsx`: admin submission display

Current server actions:

- `toggleClientSelection`
- `clearClientSelection`
- `submitPhotoSelection`

## 8. Submission behavior

Submission is intentionally idempotent at the business boundary.

Before creating a submission, the server checks for an existing submission for the same gallery/profile.

If one exists:

- no second submission is created
- the client is told that the selection has already been sent
- the official selection remains locked

When submitting:

1. Count current selected photos.
2. Reject an empty selection.
3. Insert the submission with the current count.
4. Revalidate the client gallery.
5. Revalidate the admin gallery.
6. Keep the selected-photo rows as the source of which photographs were submitted.

The stored `photo_count` is a historical snapshot of the submission event. The selected-photo rows remain the authoritative membership list.

## 9. Admin boundary

Admin should see:

- whether a selection has been submitted
- submission date/time
- submitted photo count
- submitted photos
- original photographer filenames where available

Admin must not need the client's profile cookie or client PIN.

Admin access comes from the existing admin authorization boundary.

Future admin features may add:

- selection status
- review notes
- approval/rejection
- delivery state

These should be additive and should not collapse selection with favourites.

## 10. Future feedback

Feedback is a separate concept.

Future feedback should attach to:

- gallery
- photo
- profile/client
- message
- status
- timestamps

Feedback must not be encoded as:

- a favourite
- a client-selection row
- a submission status

This keeps client communication independent from delivery selection.

## 11. Security requirements

The following are mandatory for future client-selection work:

- Never allow profile identity alone to grant client access.
- Never trust a browser-supplied gallery/photo relationship.
- Preserve composite gallery/photo integrity.
- Keep official selections separate from favourites.
- Keep submitted selections immutable unless a future revision model is explicitly introduced.
- Keep profile email data server/admin-only.
- Keep RLS enabled on client-selection tables.
- Keep service-role operations server-side.
- Never expose the client PIN.
- Do not expose another profile's selection.
- Do not allow a client to select a photo belonging to another gallery.

## 12. Future revision model

The current product has one submission per gallery/profile.

If the product later needs:

- client revision requests
- reopened selections
- multiple rounds
- photographer approval
- delivery batches

do not silently mutate the existing submission model.

Introduce an explicit revision/version model, for example:

```
Selection
  -> Revision 1
  -> Revision 2
  -> Revision 3
```

That future model must preserve historical submissions rather than rewriting them.

## 13. A4 result

The client-selection architecture is now defined.

No new database migration is required for A4 because the current schema already provides:

- profile identity
- client role authorization
- client selection rows
- submission boundary
- gallery/photo integrity
- admin review

The next phase can build on this contract without changing the fundamental identity or selection model.
