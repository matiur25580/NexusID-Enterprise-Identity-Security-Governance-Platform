# Access certification campaigns

NexusID supports periodic access certification for active access grants within an organization.

## Campaign creation

An authorized `OWNER`, `ADMIN` or `SECURITY_ANALYST` can create a campaign with a name, purpose and future deadline. Creation snapshots the organization's active grants into campaign items. The snapshot is a fixed review population: grants added after launch are not silently added to an existing campaign.

## Review decisions

Each campaign item starts as `PENDING`. An authorized reviewer must supply a rationale and choose one of two outcomes:

- **Certify** — records that the existing active grant remains appropriate.
- **Revoke** — records the decision and revokes the active grant in the same transaction.

The item decision is conditional on its status still being pending, preventing a second reviewer from overwriting an existing decision. When the last pending item is decided, the campaign automatically transitions to `COMPLETED`.

## Evidence and audit trail

The campaign stores its creator, creation time, due date, status and completion time. Each item stores the decision, reviewer, timestamp and rationale. Campaign creation, certification, revocation and campaign completion generate audit events. A certification-driven revocation also emits the standard `access.revoked` event.

## Authorization and tenant isolation

Only `OWNER`, `ADMIN` and `SECURITY_ANALYST` can create campaigns or decide items. The server derives the current organization membership and scopes all campaign/item lookups to that organization. UI controls are not treated as an authorization boundary.

## Current limitations

- Campaigns snapshot all active grants in the selected workspace; there is not yet a configurable application, risk, owner or identity scope.
- Review assignment, reminders, escalation, campaign cancellation and deadline enforcement are not implemented.
- Campaigns are currently created in `IN_PROGRESS`; there is no draft/preview stage.
- The campaign history page loads the latest 50 campaigns.
- Decisions update NexusID's grant record; no external application connector is called.
- The database schema must be applied to the configured database before this feature can be used. CI validates the Prisma schema and application build, but does not apply a production migration.
