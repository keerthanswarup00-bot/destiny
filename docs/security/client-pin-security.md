# Client PIN Security Model

Status: A5 complete
Branch: feat/admin-selected-toolbar
Date: 2026-09-25

## 1. Purpose

This document defines how gallery viewer access and client/Plus access are separated and secured.

The current system does not use email as authentication.

It uses:

- a gallery viewer password, when configured
- a separate client password/PIN, when configured
- signed, HttpOnly gallery access cookies
- lightweight email identity for favourites and client-selection ownership

The client PIN is therefore an authorization credential, not an identity field.

## 2. Two credential levels

A gallery can have two independent credentials:

| Credential | Database field | Role granted | Purpose |
| --- | --- | --- | --- |
| Viewer password | `galleries.password_hash` | `viewer` | Opens a protected gallery |
| Client PIN/password | `galleries.client_password_hash` | `client` | Unlocks client-only functionality |

The two credentials must remain separate.

A profile email does not replace either credential.

## 3. Credential storage

Credentials are never stored in plaintext.

The current implementation uses:

```
scrypt:<salt>:<derived-key>
```

The salt is randomly generated for every password hash.

Verification derives the key again and compares it with `timingSafeEqual`.

The client PIN therefore follows the same password-hashing path as the viewer gallery password.

The database stores only the resulting hash.

## 4. Minimum credential policy

The current admin write path requires at least 6 characters for both:

- viewer password
- client password

A credential shorter than 6 characters is rejected before hashing.

This is an existing product constraint, not a new A5 migration.

### Future hardening

A future credential-policy pass can increase the minimum length or recommend longer randomly generated PINs/passwords.

No complexity rule should be added merely for appearance. Length and unpredictability are the important controls.

## 5. Access flow

### Protected gallery

For a gallery with a viewer password:

```
Visitor
  |
  v
Gallery password gate
  |
  +-- viewer password -> VIEWER role
  |
  +-- client password -> CLIENT role
```

The successful credential is never returned to the browser.

Instead the server creates a signed gallery access cookie.

### Client-only gallery

For a gallery with no viewer password but a client password:

```
Visitor
  |
  v
Gallery opens as VIEWER
  |
  +-- client feature requested
          |
          v
      Client PIN dialog
          |
          v
       CLIENT role
```

This preserves the intended behavior that a client-only PIN does not block normal gallery viewing.

## 6. Signed role cookie

The access cookie is named from the gallery UUID:

```
ga_<gallery-id>
```

The signed payload contains:

```
version
gallery id
role
password fingerprint
expiry
signature
```

The role is part of the signed payload.

Therefore a client cannot modify:

```
viewer -> client
client -> viewer
gallery A -> gallery B
```

without invalidating the HMAC signature.

## 7. Password fingerprint binding

The access cookie is also bound to a fingerprint of the password hash.

Conceptually:

```
cookie role + gallery + password fingerprint + expiry
```

This provides an important revocation property.

If the administrator changes a gallery password:

1. the stored password hash changes
2. its fingerprint changes
3. existing access cookies no longer match
4. the old session is rejected
5. the visitor must authenticate again

No session-table cleanup is required for this behavior.

## 8. Cookie properties

The gallery access cookie uses:

- HttpOnly
- Secure in production
- SameSite=Lax
- path=/
- maximum age of 7 days

The browser cannot read the cookie through client-side JavaScript.

The cookie is scoped to the application root because gallery access is needed across gallery pages and related server actions.

## 9. Server-side authorization

The UI is never the security boundary.

The following server functions enforce the boundary:

- `resolveGalleryAccess()`
- `requireGalleryAccess()`
- `requireClientGalleryAccess()`
- `readGalleryAccess()`

Official client-selection actions call `requireClientGalleryAccess()`.

Therefore hiding a selection button in the UI is only presentation. A viewer cannot gain the capability by manually invoking the server action.

## 10. Viewer vs client role

A viewer role permits normal gallery functionality allowed by the gallery.

A client role is a stronger authorization state.

Client-only actions must require:

```
access.state === "granted"
AND
access.role === "client"
```

Email identity is an additional identity requirement where a feature needs to associate activity with a person.

The security model is therefore:

```
CLIENT PIN
   -> authorization

EMAIL
   -> identity

CLIENT PIN + EMAIL
   -> identified client workflow
```

Neither should be treated as a substitute for the other.

## 11. Password attempt protection

Gallery password and client PIN verification share the current access-attempt protection.

The application:

1. derives a request fingerprint
2. hashes the fingerprint server-side
3. counts recent failed attempts for that gallery/fingerprint
4. blocks further attempts after 8 failures in the current 15-minute window
5. records the blocked attempt
6. returns a generic failure message

The system does not disclose whether:

- the gallery exists
- the credential was almost correct
- the viewer or client credential was expected

This reduces credential-enumeration information.

## 12. Generic failure behavior

Authentication failures return:

```
Unable to open this gallery.
```

The client access elevation flow uses the same generic failure behavior.

This avoids revealing whether the submitted value was:

- a valid viewer password
- a valid client password
- an invalid password
- a password for another gallery

## 13. Important credential interaction

The current verification order is:

1. viewer password
2. client password

If an administrator configures the same plaintext value for both credentials, the viewer-password match wins and a viewer role is issued.

Therefore the two credentials should be configured as **different values** whenever both are enabled.

This is a configuration rule, not a database requirement.

Future admin UI can warn when both credentials are intentionally entered as the same value, but the current A5 scope does not expose or compare plaintext credentials after hashing.

## 14. Client PIN does not grant email identity

Correct client PIN:

```
CLIENT access
```

It does not automatically create or identify a profile.

Correct email:

```
PROFILE identity
```

It does not grant client access.

This prevents an email address from becoming an authorization bypass.

## 15. Client selection boundary

Official client selection requires all of:

```
published gallery
+
valid CLIENT gallery access
+
valid profile identity
+
photo belonging to that gallery
```

After submission:

```
selection_submissions exists
      -> selection mutations rejected
```

This remains a server-side rule.

## 16. Revocation model

There are two practical revocation mechanisms.

### Password rotation

Changing the viewer or client password invalidates existing cookies because the password fingerprint changes.

### Cookie expiry

Access cookies expire after 7 days.

This means client access is intentionally session-like rather than permanent.

A future explicit "Log out" control may delete the gallery access cookie immediately, but logout is not required for the server to enforce password rotation or natural expiry.

## 17. Threat model

### Threat: forged client cookie

Mitigation:

- HMAC signature
- gallery ID included in signed payload
- role included in signed payload
- password fingerprint binding
- expiry

### Threat: changing gallery ID in cookie

Mitigation:

- gallery ID is signed
- server compares token gallery ID with requested gallery ID

### Threat: changing viewer role to client

Mitigation:

- role is signed
- client role requires client password fingerprint

### Threat: using profile email as client access

Mitigation:

- profile cookie is a separate token
- `requireClientGalleryAccess()` does not consult profile identity

### Threat: selecting a photo from another gallery

Mitigation:

- server checks photo ID with current gallery ID
- database composite foreign key protects client-selection rows

### Threat: brute-force client PIN

Mitigation:

- scrypt password hashes
- per-gallery/IP-window failure limiting
- generic error messages

The current rate limit should be treated as application-layer protection, not a replacement for strong client credentials.

## 18. Future hardening

A5 identifies these possible later improvements:

1. Increase the minimum client credential length.
2. Add explicit client-PIN generation in the admin UI.
3. Add an explicit logout/revoke action.
4. Add stronger rate limiting independent of forwarded-IP trust.
5. Add security-event logging for repeated failed client access.
6. Consider a dedicated credential version/revocation model if session management becomes more complex.
7. Add an admin warning when viewer and client credentials are configured identically.

None of these changes are required to preserve the current authorization boundary.

## 19. A5 result

The client PIN security boundary is now formally documented.

The existing implementation already provides:

- separate viewer and client credentials
- scrypt hashing
- signed role-bound cookies
- password-fingerprint revocation
- 7-day expiry
- HttpOnly/Secure/SameSite cookie protection
- server-side client-role enforcement
- rate-limited failed attempts
- generic authentication errors
- separation between identity and authorization

No database migration is required for A5.
