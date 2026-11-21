# SCIM 2.0 Users, Groups and entitlement governance

## Supported resources

NexusID provides inbound SCIM 2.0 ServiceProviderConfig, ResourceTypes, Schemas, Users and Groups endpoints under /api/scim/v2. Groups support collection GET/POST and individual GET/PUT/PATCH/DELETE. Collection pagination is bounded (maximum 100). Group PATCH supports displayName and members operations; unsupported paths are rejected.

## Group isolation

A group belongs to exactly one SCIM connector. Its members must be identities provisioned by that same connector and organization. A connector cannot attach another connector's users or read/update another connector's groups. Group externalId is unique per connector. Group membership is stored as normalized relational rows, not unvalidated JSON.

## Entitlement mapping and access controls

Workspace OWNER and ADMIN users can map an inbound group to an enabled NexusID entitlement in the SCIM integration workspace. When group membership is synchronized, NexusID evaluates the same deterministic baseline and enabled custom access policies used by the normal request workflow.

- DENY results create no access request and produce a denial audit event.
- ALLOW and REVIEW outcomes create a PENDING AccessRequest.
- The request includes a clear group-mapping rationale and the connector creator as requester for traceability.
- A human approver must still decide the request. Existing approval-time policy reevaluation and self-approval prevention remain in effect.
- Duplicate active grants and pending requests are not duplicated.

Removing a member, deleting a group, or removing a mapping does not automatically revoke active grants or cancel previously created requests. Administrators must use existing governance, certification and lifecycle workflows to make those decisions. This avoids destructive implicit access changes from an upstream group sync.

## Audit and tenant security

Group create/update/delete and mapping create/remove events are audited. Every group/member/mapping query is organization and connector scoped. Mapping creation validates that both the group and enabled entitlement belong to the current workspace.

## Outbound provisioning and reconciliation

Not included. This release does not send changes to downstream SaaS applications, manage external API credentials, retry delivery, or reconcile drift. Those capabilities require a separately configured outbound target, credential lifecycle, idempotency strategy, delivery outbox/worker and operational monitoring. Do not interpret inbound SCIM support as outbound provisioning.

## Database migration

Migration: apps/web/prisma/migrations/20261121150000_add_scim_groups_and_entitlement_mappings/migration.sql. It adds ScimGroup, ScimGroupMember and ScimGroupEntitlementMapping. Existing Users and connectors are unchanged. Review and back up the target database, then apply using the controlled Prisma migration process. No live database was modified during development.

## Verification

Run pnpm test:scim, pnpm test:scim-groups, pnpm db:generate, pnpm db:validate, pnpm test:integration, pnpm typecheck and pnpm build.
