# PostgreSQL row-level security policy foundation

## Status: policies prepared, not activated in the application

The migration at `apps/web/prisma/migrations/20261121180000_prepare_tenant_rls_policies/migration.sql` creates a fail-closed tenant-context function and policies for tenant-owned tables. It deliberately does **not** execute `ENABLE ROW LEVEL SECURITY` or `FORCE ROW LEVEL SECURITY`.

This is intentional. Current server actions and route handlers use the shared Prisma client directly, and do not consistently establish a transaction-local tenant context. Enabling RLS before that request boundary is implemented would cause legitimate application reads and writes to fail, or encourage unsafe bypasses. The policy foundation is therefore inert until the runtime context rollout is complete.

## Runtime context progress

A reusable `withTenantContext(organizationId, work)` helper now opens a Prisma interactive transaction and sets `app.current_organization_id` with transaction-local `set_config(..., true)`. The helper is now used by identity create/status/risk-snapshot actions; governance, policy, certification, lifecycle and SCIM connector server-action write transactions; SCIM Users and Groups write endpoints; SCIM group-access synchronization writes; and the internal scheduled risk-snapshot write transaction.

This remains a partial rollout, not complete application coverage. Several tenant-scoped read queries in these flows still rely on explicit organization filters rather than a transaction-local RLS context. Other page loaders, route handlers, scheduled/background jobs, and all remaining Prisma access paths still require conversion and tests before RLS can be activated. SCIM endpoints also need adversarial authenticated integration coverage under a restricted runtime role. Do not enable RLS on a shared or production database based only on this helper's presence.

## Policy contract

- Tenant context is transaction-local: `set_config('app.current_organization_id', <organization-id>, true)`.
- The helper `app.current_organization_id()` reads the setting and returns NULL when it is missing or empty.
- Every direct tenant-owned table policy compares its `organizationId` to the current context for both `USING` and `WITH CHECK`.
- Child tables without an organization column inherit access through their tenant-owned parent: certification items through campaigns, policy versions through policy rules, and SCIM group members through groups.
- Missing context fails closed: SELECT sees no tenant rows and writes fail policy checks.

Membership, User, Account, Session and VerificationToken are not covered by these policies. Membership is currently used to resolve the user's active workspace before tenant context is established; global identity/authentication tables have different access semantics.

## CI verification

CI applies the policy-definition migration after creating the disposable PostgreSQL schema. The integration test then enables and forces RLS on the covered tables **inside a transaction**, verifies:
1. Missing context returns no tenant identities.
2. Tenant A context sees only Tenant A identities, applications and entitlements.
3. Switching the transaction-local context to Tenant B exposes only Tenant B rows.

The test creates a temporary `NOLOGIN NOSUPERUSER NOBYPASSRLS` role, grants only the required read permissions, and uses `SET LOCAL ROLE` so the checks run under a role that cannot bypass RLS. It deliberately throws a sentinel error after assertions so PostgreSQL rolls back the role, grants and DDL, leaving the CI database's RLS activation state unchanged. This tests the real PostgreSQL policies while keeping the current application behavior unchanged.

## Required runtime rollout before activation

1. Add a tenant transaction helper that sets the context with a parameterized `set_config(..., true)` inside the same transaction as every tenant query.
2. Resolve membership before entering the tenant transaction; validate the selected organization membership on every request.
3. Convert server actions, page data loaders, SCIM endpoints, scheduled jobs and internal APIs to use the tenant transaction boundary. Background jobs must iterate one organization per transaction.
4. Introduce a restricted runtime database role that is neither superuser nor table owner and has no `BYPASSRLS`; keep migrations on a separate owner role.
5. Add authenticated E2E tests for tenant A/B reads, writes, updates, deletes, SCIM, certification, and background jobs.
6. Only then ship a separate activation migration using `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` for each covered table, and run adversarial tests using the restricted runtime role.

Do not enable RLS manually in a production database until all runtime paths set transaction-local context and the restricted-role tests pass. The current system continues to rely on application-level organization scoping plus tenant-consistent relational constraints.
