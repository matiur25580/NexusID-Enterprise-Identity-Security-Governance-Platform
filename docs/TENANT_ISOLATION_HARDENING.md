# Tenant isolation hardening: PostgreSQL RLS and authenticated E2E

## Status

**Planned; not implemented.** This document records the next security milestone and its acceptance criteria. Existing application queries are tenant-scoped by convention. The current PostgreSQL integration test checks representative scoped queries and role-policy behavior; it does not prove that PostgreSQL rejects an unscoped or cross-tenant query.

No database schema, production database, deployment, or credentials are changed by this plan.

## Security objectives

1. A request authenticated as a member of organization A cannot read or mutate organization B data, even if an application query omits its organization predicate.
2. A row that references an identity, entitlement, grant, request, group, or other tenant-owned record must reference a record in the same organization.
3. Background jobs and SCIM bearer-token requests receive an explicit, narrowly scoped tenant context.
4. Tenant context is transaction-local and cannot leak through a pooled PostgreSQL connection to the next request.
5. Tests prove isolation using the actual database role and execution path used by the application, not only helper functions or hand-written scoped queries.

## Current-state observations

- The Prisma schema stores `organizationId` on many tenant-owned tables.
- The application uses Prisma and resolves membership in server-side authorization helpers.
- SCIM requests derive organization scope from a connector token.
- Scheduled risk assessment iterates organizations as a system process.
- Prisma currently uses ordinary queries; no PostgreSQL RLS policies or tenant-context transaction wrapper were found in the reviewed implementation.
- The existing tenant integration test manually supplies `organizationId` in Prisma filters. It is useful regression coverage, but it is not an RLS test.
- Core tenant-owned relationships now have a separate composite-foreign-key implementation on the `security/tenant-relational-integrity` branch. See [TENANT_RELATIONAL_INTEGRITY.md](TENANT_RELATIONAL_INTEGRITY.md). This does not replace RLS and does not yet cover every relation.
- Fail-closed RLS policies are defined and tested in a rolled-back PostgreSQL transaction, but intentionally not enabled for application traffic until all Prisma access paths establish transaction-local tenant context. See [TENANT_RLS_POLICY_FOUNDATION.md](TENANT_RLS_POLICY_FOUNDATION.md).

## Target architecture

### 1. Establish database roles

Use separate PostgreSQL roles for migrations/administration and runtime application access.

- The runtime role must not own protected tables, must not be a superuser, and must not have `BYPASSRLS`.
- The migration role owns schema changes and is never used by the deployed web process.
- Local development and CI must exercise the runtime role, not silently connect as the table owner.
- Verify role attributes in a database preflight check and fail closed if the runtime role bypasses RLS.

### 2. Set tenant context transaction-locally

Introduce a single audited Prisma helper that opens an interactive transaction, sets the tenant context using parameterized SQL and executes the callback on that transaction client.

Conceptual SQL:

```sql
SELECT set_config('app.current_organization_id', $1, true);
```

The final `true` makes the setting transaction-local. Never use session-scoped `SET` on pooled connections.

The helper must:
- Accept an organization ID obtained from verified server-side membership or a validated SCIM connector, never directly from a browser-supplied organization ID.
- Use the transaction client for every tenant-owned query in the callback.
- Avoid leaking the root Prisma client into tenant-scoped service functions.
- Define safe behavior for nested service calls; do not silently start an independent transaction that loses tenant context.
- Keep transactions short and configure bounded transaction timeouts.
- Expose a separate, explicitly named system-job path for cross-tenant scheduled work. That path must iterate one organization at a time and establish a tenant context for each iteration.

### 3. Apply deny-by-default RLS policies

For every table with a direct `organizationId`, enable and force row-level security. Policies should compare the row tenant to the transaction-local setting and return no rows / reject writes when the setting is absent.

Conceptual predicate:

```sql
organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
```

Use both `USING` and `WITH CHECK` so reads/updates/deletes are scoped and inserted or updated rows cannot be assigned to another tenant.

Tables without a direct organization column (for example, membership children, certification items, policy versions, and SCIM group members) require an explicit design:
- Add a tenant key where it materially improves safe enforcement, or
- Use carefully reviewed parent-row policies / security-definer functions with a fixed safe search path.
- Do not assume an RLS policy on a parent automatically filters child tables.

Keep global authentication tables (users, OAuth accounts, sessions, verification tokens) outside tenant RLS unless a separate user-data policy is designed. A user can legitimately belong to multiple organizations.

### 4. Enforce same-tenant relational integrity

Add composite unique keys and composite foreign keys where tenant-owned records reference each other. At minimum, review relationships involving:
- Identity ↔ organization
- Application ↔ organization
- Entitlement ↔ application and organization
- Access request ↔ identity, entitlement and organization
- Access grant ↔ identity, entitlement and organization
- Certification campaign/item ↔ organization and grant
- Risk snapshot/alert ↔ identity and organization
- Lifecycle request ↔ identity and organization
- SCIM connector/group/member/mapping ↔ organization and connector-owned identity

Before adding constraints, run an audit query to find existing cross-tenant references. Resolve or quarantine invalid rows explicitly; never silently rewrite ownership. Stage large constraints safely and document lock impact.

### 5. Refactor all request paths

Migrate tenant-owned data access through the tenant transaction boundary:
- App Router pages and server actions
- Internal APIs
- SCIM Users and Groups handlers
- Certifications, lifecycle, policies and access governance
- Scheduled risk assessment

For SCIM, resolve the tenant from the authenticated connector, not from request payloads. For background work, iterate organizations and run one tenant-scoped transaction per organization. Do not grant the normal runtime role a general RLS bypass to make jobs easier.

## Authenticated end-to-end testing

Add a browser E2E suite (Playwright or an equivalent maintained runner) with isolated test users and organizations. Cover:

1. Sign-in, onboarding and workspace selection.
2. Role matrix: OWNER, ADMIN, SECURITY_ANALYST, AUDITOR and MEMBER.
3. Identity creation and directory visibility.
4. Access request, policy evaluation, approval and revocation.
5. Certification review and lifecycle approval.
6. SCIM connector authentication, cross-connector resource denial and group membership validation.
7. Direct URL/API access attempts against another tenant's resource.
8. Missing tenant context and stale/revoked membership behavior.

Tests must assert both response behavior and database state. Never use production identities or credentials. CI must create disposable test data and clean it up even after failures.

## Required adversarial RLS tests

Run as the non-owner runtime database role:

- No tenant context: protected SELECT returns zero rows; INSERT/UPDATE fails.
- Tenant A context: A rows are visible; B rows are invisible.
- Tenant A context: attempts to insert or update a row with tenant B's ID fail.
- Tenant A context: joins and nested relations cannot expose B rows.
- A transaction ends: the next transaction on the same pooled connection has no inherited tenant context.
- Two concurrent transactions for A and B cannot observe each other's rows.
- The application table owner / migration role is not used by runtime integration tests.
- A tenant-owned child row cannot reference a parent in another tenant.

A test that only includes `where: { organizationId }` is not an RLS acceptance test.

## Migration and rollout sequence

1. Inventory every Prisma model, relation and raw SQL statement that touches tenant-owned data.
2. Add a read-only cross-tenant integrity audit and save its output as test evidence (no personal data).
3. Add composite tenant keys and foreign keys after resolving existing violations.
4. Create and verify the restricted runtime role in local and CI databases.
5. Add RLS policies in a migration; test them directly before changing application code.
6. Introduce the transaction-scoped tenant helper and migrate one domain at a time.
7. Add authenticated E2E tests and adversarial database tests to required CI checks.
8. Enable FORCE RLS for all approved tenant tables only after every access path is migrated.
9. Verify backup/restore and rollback procedures. RLS rollback must never be the default response to a failed deployment; fail closed and repair the access path.

## Acceptance criteria

- [ ] Runtime DB role is non-owner, non-superuser and has no RLS bypass.
- [ ] RLS is enabled and forced on every approved tenant table.
- [ ] Missing tenant context is denied by default.
- [ ] Transaction-local context cannot leak across pooled connections.
- [ ] Cross-tenant foreign-key references are rejected by PostgreSQL.
- [ ] All user, SCIM and scheduled-job paths use the approved tenant boundary.
- [ ] Authenticated E2E and role-matrix tests run in CI.
- [ ] Adversarial RLS tests run in CI using the runtime role.
- [ ] Migration, backup, recovery and rollback procedures are reviewed.
- [ ] Documentation accurately distinguishes implemented controls from planned controls.

## Explicit non-goals for this milestone

This work does not claim production certification, tamper-proof audit storage, SAML federation, outbound SCIM provisioning, privileged session brokering, or external SIEM delivery. Those remain separate roadmap items.
