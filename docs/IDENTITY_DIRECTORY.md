# Identity directory

The first directory milestone provides tenant-scoped identity discovery and basic lifecycle status management.

## Identity types

- `HUMAN`: workforce identities.
- `SERVICE`: service accounts and application principals.
- `WORKLOAD`: machine and workload identities.
- `AI_AGENT`: autonomous or assisted AI-agent identities.

## Directory behavior

- The server resolves the signed-in user's organization membership.
- The page queries only identities belonging to that organization.
- The initial view is capped at the 250 most recently updated records.
- Client-side filters cover display name, email, external ID, source, identity type and status.
- New identities start in `PENDING`.
- Authorized operators can change status to Active, Pending, Suspended or Disabled.

## Authorization

Creating identities and changing their status require an authenticated membership with one of these roles:

- `OWNER`
- `ADMIN`
- `SECURITY_ANALYST`

Auditors and members can view the directory but cannot write to it. Every write re-checks the membership against the identity's organization on the server; the UI role is only a presentation hint.

## Audit behavior

Creation and status changes write an `AuditEvent` in the same database transaction as the identity mutation. Audit metadata records identity type/source or previous/new status. The event actor is the authenticated user.

## Known limitations

- This milestone is a manual directory, not a live HRIS/IdP synchronization connector.
- The page loads at most 250 records; cursor pagination and server-side search are future work.
- No identity deletion endpoint is exposed; suspension and disablement preserve the audit trail.
- The app currently chooses the oldest membership as the active workspace. A secure workspace switcher and active-tenant selection remain future work.
- The dashboard's overview metrics and activity feed remain illustrative until backed by real event queries.
