# Identity lifecycle management

## Scope

The internal `/lifecycle` workspace implements approval-controlled Joiner, Mover and Leaver requests. All operations are scoped to the authenticated user's current organization and audited.

## Event semantics

- Joiner: only a PENDING identity can be activated.
- Mover: a reviewer revokes only the explicitly selected ACTIVE grants belonging to that identity. The request stores selected grant IDs as an immutable request snapshot.
- Leaver: a reviewer disables the identity and revokes every ACTIVE grant in the same transaction.
- Rejection records the reviewer, timestamp and mandatory rationale without changing identity or grants.

Request creation is available to OWNER, ADMIN, SECURITY_ANALYST and MEMBER. Approval and rejection require OWNER, ADMIN or SECURITY_ANALYST. AUDITOR is read-only.

## Safety and concurrency

The server resolves the organization from the signed-in user's membership; no client-provided organization ID is trusted. Identity and grant lookups include organization scope. Approval claims the pending request with a conditional update inside a transaction. Identity status and grant status are also checked conditionally. A mismatch throws and rolls back the transaction, preventing partial lifecycle execution. A pending request per identity is enforced by a scoped application check; a future database-level partial unique index would strengthen this under concurrent request creation.

## Deliberate boundaries

This release does not provision/deprovision accounts in external identity providers, sync directory attributes, rotate credentials, retry remote jobs, or reconcile external state. Joiner approval activates an existing pending NexusID identity; it does not create an external account. SCIM 2.0, connector credentials, inbound event verification and outbox-driven provisioning remain separate future work.

## Database

Additive migration: `apps/web/prisma/migrations/20261121120000_add_identity_lifecycle/migration.sql`. Review against the deployed schema, back up, and apply through a controlled migration process. Do not use `db:push` in production.

## Tests

Run `pnpm test:lifecycle`. The regression suite covers joiner eligibility, mover grant selection, leaver revocation intent and invalid event combinations. Database-level tenant/authorization and concurrency behavior remains covered by server-side scoping and existing PostgreSQL integration tests; dedicated lifecycle multi-tenant integration cases are still a follow-up.
