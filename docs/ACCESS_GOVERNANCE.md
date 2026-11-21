# Entitlement catalog and access governance

This milestone introduces an organization-scoped application catalog, entitlement definitions, access requests, approvals and grant revocation.

## Domain model

- **Application** represents an organization-owned system or service. Its slug is unique within the organization.
- **Entitlement** represents a permission or access bundle in an application. Each application has unique entitlement keys. Entitlements include risk level, a privileged flag and an enabled flag.
- **AccessRequest** records the target identity, entitlement, requester, business justification, status and reviewer decision.
- **AccessGrant** records the resulting assignment, grant actor, grant time and revocation state.

## Workflow

1. A workspace member selects an active identity and enabled entitlement and submits a business justification.
2. A request enters `PENDING`.
3. An `OWNER`, `ADMIN` or `SECURITY_ANALYST` reviews it and supplies a decision rationale.
4. Approval creates an active grant in the same database transaction as the request decision.
5. Rejection records the reviewer and rationale without creating a grant.
6. Authorized operators can revoke active grants. Revocation preserves the grant record and records a timestamp.

The requester cannot approve or reject their own request. A request can only be decided once; the decision update is conditional on the request still being pending. Only active identities can receive access, and disabled entitlements cannot be approved.

## Authorization

- Application and entitlement creation: `OWNER`, `ADMIN`, `SECURITY_ANALYST`.
- Access requests: authenticated organization members other than `AUDITOR`.
- Review and grant revocation: `OWNER`, `ADMIN`, `SECURITY_ANALYST`.
- `AUDITOR` and `MEMBER` can inspect governance data but cannot manage the catalog or grants.

Every operation resolves the current user's organization membership on the server and checks the referenced identity, application or entitlement against that organization. UI visibility is not an authorization boundary.

## Audit events

The following actions create audit events in the same transaction as the corresponding mutation:

- `application.created`
- `entitlement.created`
- `access.requested`
- `access.approved`
- `access.rejected`
- `access.revoked`

The audit metadata captures relevant resource IDs and risk/privilege attributes. Business justifications and reviewer rationales are retained with the request record and included as audit reasons.

## Operational notes and limitations

- The page loads up to 100 recent requests and 100 recent grants; the catalog page is not yet cursor-paginated.
- This is a governance record and approval workflow. It does not provision or revoke permissions in external applications. Connector execution and reconciliation are future work.
- Entitlement risk levels are metadata; no automated policy engine currently blocks requests based on risk level.
- The oldest organization membership is still selected as the active workspace. An explicit workspace switcher remains future work.
- The Prisma schema must be applied to the configured database before using this feature. CI validates the schema and build; it does not run a production database migration.
