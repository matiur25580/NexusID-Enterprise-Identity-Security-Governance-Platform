# Tenant relational integrity

## Scope

This migration adds PostgreSQL composite foreign keys that require tenant-owned records to reference related records from the same organization. It is a database integrity control and does **not** implement PostgreSQL row-level security (RLS).

The constraints cover:

- Entitlement → Application
- AccessRequest → Identity and Entitlement
- AccessGrant → Identity and Entitlement
- IdentityRiskSnapshot / IdentityRiskAlert → Identity
- LifecycleRequest → Identity
- ScimGroup → ScimConnector
- ScimGroupEntitlementMapping → ScimGroup and Entitlement

The referenced tables receive composite unique keys on `(id, organizationId)`. Existing single-column primary keys and foreign keys remain in place, preserving existing Prisma relations and delete behavior.

## Migration

`apps/web/prisma/migrations/20261121170000_add_tenant_relational_integrity/migration.sql`

The migration creates the composite unique indexes and adds composite foreign keys with cascading deletes/updates consistent with the existing relations.

It intentionally fails if existing rows contain cross-organization references. Do not disable or skip the constraints to force a migration through. Inspect the offending relationships, decide the correct ownership with an administrator, repair or quarantine invalid rows, back up the database, and retry.

For the current schema-first CI setup, the workflow runs `pnpm db:push` on an ephemeral PostgreSQL database and then applies this SQL migration with `psql`. On a fresh local test database, the same sequence is:

```bash
pnpm db:push
psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f apps/web/prisma/migrations/20261121170000_add_tenant_relational_integrity/migration.sql
pnpm test:integration
```

The SQL file is a forward-only migration. Do not run it twice manually: PostgreSQL constraint creation is intentionally not hidden behind a broad exception handler.

## Regression coverage

The tenant integration test creates two organizations, identities, applications and entitlements. It confirms:
- Valid same-organization relationships can be created.
- An entitlement cannot reference another organization's application.
- An access request cannot reference another organization's identity.
- Existing application-level query scoping and membership-role checks continue to run.

The CI workflow applies the constraints before running the integration suite, so these negative tests exercise PostgreSQL rather than mocked authorization logic.

## Limitations and next steps

- This is not RLS. A query that omits an organization filter can still read rows if the database role has access.
- This does not yet constrain every tenant-owned relationship. In particular, certification items and SCIM group members need an explicit tenant key design before equivalent composite constraints can be added.
- Global user relations intentionally remain cross-organization capable because one user may be a member of multiple organizations.
- Continue with adversarial PostgreSQL RLS tests, a restricted runtime database role, transaction-local tenant context, and authenticated browser E2E coverage as described in [tenant isolation hardening](TENANT_ISOLATION_HARDENING.md).
