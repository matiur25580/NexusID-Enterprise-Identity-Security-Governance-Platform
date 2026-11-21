# SCIM 2.0 provisioning — initial Users scope

## Scope and protocol

NexusID exposes an inbound SCIM 2.0 Users service-provider API under /api/scim/v2. This initial release supports Users collection GET/POST and individual User GET/PUT/PATCH/DELETE. Responses use SCIM 2.0 schemas and application/scim+json. List pagination supports startIndex and count; supported filters are exact userName equality and externalId equality only.

## Connector credentials

Only organization OWNER and ADMIN can create/revoke connectors. A generated nxs_scim_ bearer token is shown once; only a SHA-256 digest is stored. Connector records are tenant-bound. Revocation disables the credential immediately. Store tokens in an upstream secret manager and use HTTPS. Rotate by creating a replacement connector, switching the upstream source, then revoking the old connector.

## User mapping

SCIM userName maps to the tenant-unique Identity.userName field. externalId remains the upstream stable identifier; displayName and primary email map to the identity directory. SCIM users are created as HUMAN identities. No SCIM operation creates entitlements, access requests or grants.

SCIM active=true maps to ACTIVE; active=false or DELETE maps to DISABLED. Deactivation and revocation of all active NexusID grants happen in a single transaction with an audit event. Reactivation changes identity status only; it does not restore previously revoked grants.

## Isolation and audit

Every API operation authenticates a connector token and scopes identity reads/writes to that connector's organization. A valid connector cannot access another tenant's user by guessing its ID. Connector create/revoke and user create/update/deactivate events are audited. Raw credentials are never persisted or returned after initial creation.

## Current limitations

- SCIM Groups and group membership are not implemented.
- No outbound provisioning client, event outbox, worker, retry/backoff or periodic reconciliation exists.
- Filter support is deliberately narrow; unsupported filters return 400.
- Attribute support is intentionally limited to userName, externalId, displayName, active, emails and formatted name.
- No application-level rate limiter is included. Place an API gateway/WAF with rate limits in front of the endpoint, enforce TLS, and monitor authentication failures before production use.
- Dedicated end-to-end SCIM API tests against PostgreSQL are not yet included; pure protocol mapping/validation tests and the existing tenant isolation suite run in CI.

## Database migration

Migration: apps/web/prisma/migrations/20261121133000_add_scim_user_provisioning/migration.sql. It adds nullable Identity.userName with a tenant-scoped unique index and the ScimConnector table. Existing rows remain valid because userName is nullable. Review against the target database, back up and apply in a controlled maintenance/deployment process. Do not use db:push in production.

## Verification

Run pnpm test:scim, pnpm db:generate, pnpm db:validate, pnpm test:integration, pnpm typecheck and pnpm build.
