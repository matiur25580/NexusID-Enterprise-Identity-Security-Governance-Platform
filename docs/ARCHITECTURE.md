# Architecture

## Current milestone

The repository starts as a modular Next.js application with PostgreSQL as the system of record. The first commit establishes the product shell, domain vocabulary and initial persistence model. The dashboard currently uses hard-coded demonstration data and is deliberately marked as such.

## Logical boundaries

- **Experience layer** — Next.js App Router pages, layouts and accessible components.
- **Application layer** — use cases for identity lifecycle, access requests, certification and policy evaluation.
- **Domain layer** — organizations, memberships, identities, entitlements, grants, policies and audit events.
- **Infrastructure layer** — Prisma repositories, protocol connectors, queues, secrets and telemetry.

Keep business rules out of React components and route handlers. Route handlers should authenticate, validate input, resolve the tenant context, authorize the action and delegate to an application use case.

## Planned evolution

1. Add authentication and organization context.
2. Add an authorization service that checks organization membership and permission on every server-side operation.
3. Add identity and entitlement repositories with tenant-scoped query helpers.
4. Add a transactional outbox and background worker for provisioning.
5. Introduce connector adapters for OIDC, SAML and SCIM.
6. Extract high-throughput workers or protocol services only when operational needs justify separate deployment.

## Multi-tenancy

Every tenant-owned record must carry an organization identifier. All reads and writes must be scoped by the authenticated organization on the server. Never trust an organization ID supplied by a browser without verifying membership. Add PostgreSQL row-level security as defense in depth before production use.

## Security invariants

- Deny by default; policy evaluation errors must not grant access.
- Enforce authorization on the server for every sensitive operation.
- Treat user-supplied IDs as untrusted and prevent insecure direct object references.
- Keep secrets out of source control, logs, client bundles and audit metadata.
- Use idempotency keys and unique constraints for externally triggered lifecycle events.
- Audit both successful and denied security-sensitive actions.
- AI-generated risk explanations are advisory; access changes require deterministic policy checks and configured human approval.
- Use append-only audit semantics in application code and plan tamper-evident storage for production.

## Operational concerns

Use structured logs with request and correlation IDs. Instrument API latency, queue age, connector failures and provisioning retries. Define retention, backup, restore and incident-response procedures before production deployment.
