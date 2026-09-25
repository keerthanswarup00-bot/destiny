# Analytics Architecture

Status: A6 complete
Branch: feat/admin-selected-toolbar
Date: 2026-09-25

## 1. Purpose

This document defines the analytics boundary for the Destiny gallery system.

Analytics must answer operational questions such as:
- How many people viewed a gallery?
- How many total views occurred?
- How many visitors returned?
- When was a gallery first and most recently viewed?
- Which identified visitors have interacted with a gallery?
- Which identified visitors have made selections?

Analytics must remain separate from gallery business state.

## 2. Current analytics model

The existing analytics foundation is gallery_views.
It stores one aggregated row per gallery + visitor.
The row contains gallery_id, visitor_key, view_count, first_viewed_at, and last_viewed_at.
A unique constraint on (gallery_id, visitor_key) prevents duplicate visitor rows.
An index on (gallery_id, last_viewed_at desc) supports gallery-level recent activity queries.

## 3. What counts as a gallery view

A gallery view is a visit to the gallery overview/page-load boundary.
The current model intentionally does not create a separate analytics event for set changes, lightbox opening, favourites, downloads, shares, slideshow starts, photo selection, or other UI interactions.
Those are business actions or UI interactions and must not be silently mixed into gallery_views.

## 4. Visitor identity

Identified visitors use profile:<profile UUID> as the server-side visitor key.
Anonymous visitors use ip:<hashed request fingerprint>.
The underlying IP is not stored in the analytics table.
The visitor key is server-generated and must never be exposed to the browser.

## 5. Privacy boundary

gallery_views is private operational data. RLS is enabled and access is admin-only.
The service-only record_gallery_view function is SECURITY DEFINER, uses search_path = public, is revoked from PUBLIC, and is executable only by service_role.
The client never calls the database function directly.

## 6. Current metrics

Unique visitors = number of gallery_views rows for the gallery.
Total views = sum of view_count across the gallery visitor rows.
Returning visitors = number of visitors whose view_count is greater than 1.
First viewed = minimum first_viewed_at.
Last viewed = maximum last_viewed_at.
Returning visitors is a visitor-level indicator, not a count of individual return sessions.

## 7. Current admin email insight

The admin analytics layer can associate identified gallery visitors with profiles.
The relationship is gallery_views visitor_key -> profile UUID -> profiles.email.
Anonymous visitors have no profile mapping.
The admin email surface can combine identified gallery views, profile email, favourite/selection activity, and marketing opt-in state.
This is an admin-only surface.
Emails must not be exposed through public gallery data, client props, public APIs, storage URLs, or browser analytics payloads.

## 8. Analytics vs business state

Analytics must not become the source of truth for business operations.
gallery_views does not determine whether a gallery is published.
selections determines favourites.
client_selection_photos determines the current official client selection.
selection_submissions determines whether that selection was formally submitted.
access_attempts records gallery access attempts.
photo_shares records share-token state.
Analytics may report on these systems later, but must not replace them.

## 9. Future event analytics

If Destiny later needs detailed interaction analytics, create an additive event model rather than expanding gallery_views with unrelated columns.
A future event table could contain id, gallery_id, optional folder_id, optional photo_id, optional profile_id, an anonymous visitor/session identifier where required, event type, event timestamp, and limited event metadata.
Potential event types include gallery_view, set_view, photo_open, favorite, favorite_remove, download, share, slideshow_start, client_selection_add, client_selection_remove, and selection_submit.
This is future architecture only. A6 does not create this table.

## 10. Event collection rules

1. Events are written server-side or through a controlled server endpoint.
2. Browser code must never receive or choose privileged visitor identifiers.
3. Event types must come from an allowlist.
4. IDs must be validated against the current gallery.
5. Cross-gallery photo/folder references must be rejected.
6. Private profile/email data must not be copied into event metadata.
7. Event metadata must remain small and bounded.
8. Analytics failures must not break normal gallery functionality.
9. Analytics writes should be best-effort unless the event is itself a required business transaction.
10. High-volume interaction events should not synchronously block page rendering.

## 11. Idempotency and duplicate events

The existing record_gallery_view function uses an upsert and increment.
The first visit creates the row and subsequent visits increment view_count.
Future event analytics must explicitly define whether each event is idempotent, intentionally repeatable, or deduplicated within a short client/session window.
Business actions such as selection submission remain controlled by business-table constraints rather than analytics deduplication.

## 12. Gallery-level aggregation

The first analytics layer remains gallery-centric.

| Metric | Meaning |
| --- | --- |
| Unique visitors | Distinct visitor keys for the gallery |
| Total views | Sum of aggregated visitor view counts |
| Returning visitors | Visitors with more than one recorded view |
| First viewed | Earliest recorded gallery view |
| Last viewed | Most recent recorded gallery view |
| Identified visitors | Visitors that map to a profile |
| Selection activity | Profile-linked selection activity |

The existing admin gallery page already consumes the first five metrics.

## 13. Dashboard aggregation

A future admin dashboard can aggregate gallery-level data across galleries.
For example, dashboard total views can be the sum of view_count across gallery_views.
The dashboard should not expose raw visitor keys.
When a dashboard needs client-specific information, it should aggregate or join through server-side admin functions rather than sending raw analytics identifiers to the browser.

## 14. Retention and deletion

A6 does not introduce a retention/deletion policy.
Before detailed analytics are expanded, Destiny should decide how long anonymous analytics are retained, how long identified analytics are retained, what happens when a gallery is deleted, what happens when a profile is deleted, and whether historical aggregate counts should survive deletion.
The current schema cascades gallery deletion to gallery_views.
Any future retention job must preserve the distinction between operational analytics and required business records.

## 15. Time handling

Analytics timestamps are stored as timestamptz.
Server-side aggregation should operate on absolute timestamps.
Display formatting can convert timestamps to the admin user's local timezone.
Relative labels are presentation concerns and must not change stored timestamps.

## 16. Failure behavior

Analytics should be non-blocking.
If analytics recording fails, gallery access, photo browsing, favourites, client selection, and downloads should continue.
The current admin analytics helpers already use safe fallback values when reads fail.
Analytics errors should be logged server-side when useful for operations, without exposing internal database or visitor details to gallery visitors.

## 17. Security requirements

Every future analytics implementation must preserve admin-only reads for private analytics, service-role-only execution of service functions, fixed search_path for SECURITY DEFINER functions, no public visitor-key exposure, no raw IP storage where a hashed identifier is sufficient, no email in anonymous analytics records, gallery-scoped photo/folder validation, bounded event metadata, and server-side authorization for identified/private analytics.

## 18. Product boundary

Analytics are for understanding gallery usage and client activity.
They should not be used to infer sensitive personal characteristics or make automated decisions about a client.
The admin UI should show concrete activity metrics rather than speculative visitor profiles.

## 19. A6 result

The analytics architecture is now defined.
The existing gallery_views model remains the canonical source for gallery-level visitor counts.
No new analytics event table is required for A6.
Future detailed interaction tracking, if needed, should be implemented as a separate additive event model rather than changing gallery_views into a generic event table.