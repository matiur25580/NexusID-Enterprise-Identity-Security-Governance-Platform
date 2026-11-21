# Security integration testing and risk trends

## Database-backed isolation tests

Run against a dedicated PostgreSQL database named `nexusid`, never a production database:

```bash
NEXUSID_INTEGRATION_TEST=1 pnpm test:integration
```

The test creates two isolated organizations and users, persists separate memberships and identities, and verifies tenant-filtered identity/audit queries and role decisions against persisted membership records. Test fixtures are removed in a finally block. The integration test refuses production mode and refuses database names other than `nexusid`.

CI provisions an ephemeral PostgreSQL 16 service, applies the current Prisma schema with `pnpm db:push`, then runs both policy regression and tenant integration tests.

The suite validates the tenant-filter and role-policy primitives used by server authorization. It does not yet exercise the full Next.js server-action request lifecycle, OAuth/session cookies, or PostgreSQL row-level security (which is not configured).

## Risk snapshot history

An authorized OWNER, ADMIN or SECURITY_ANALYST can capture one risk snapshot per identity per UTC calendar day from the Identity Directory. The snapshot stores score, classification, methodology and the factor breakdown. The database unique key makes repeat captures on the same day idempotent. Every capture attempt is audit logged with actor, date and identity count.

The directory displays up to 14 recent daily points within a 30-day window: number of identities captured, average score and count of identities at HIGH/CRITICAL risk (score 50+). A day without a snapshot is not treated as a zero-risk day.

Snapshots are tenant-scoped and cascade with their organization/identity. No automated scheduler, retention job, alerting threshold, or historical backfill is included. Operators must capture snapshots daily to build a useful trend. Capture uses the current deterministic methodology; compare methodology versions carefully if scoring weights change.

## Database update

The additive migration is `apps/web/prisma/migrations/20261121103000_add_identity_risk_snapshots/migration.sql`. Review and back up the target database before applying. This repository previously had no committed migration history; for an existing installation, apply this additive SQL once under a controlled change window, or use `pnpm db:push` only in a deliberately selected environment after reviewing the diff. Do not point local/test commands at production.
