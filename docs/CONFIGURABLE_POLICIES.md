# Configurable policy management

NexusID supports tenant-scoped custom policy rules alongside its immutable baseline controls.

## Capabilities

- Create custom policy drafts with an allow-listed condition field, operator and expected value.
- Select an outcome: DENY, REVIEW or ALLOW.
- Set deterministic priority (lower numbers are evaluated first).
- Simulate a selected identity/entitlement pair against the baseline and custom draft rules.
- Enable a draft only after a simulation has been run since its latest edit.
- Disable an active rule before editing it; edits create a new version and require another simulation.
- Review the latest five immutable policy-version snapshots and change notes.
- Record create, edit, enable, disable and simulation events in the tenant audit trail.

Policy administration is available to OWNER, ADMIN and SECURITY_ANALYST roles. Rules are always scoped to the current organization. The evaluator uses an explicit allow-list and never evaluates arbitrary expressions or user-supplied code.

## Supported conditions

| Field | Example value |
|---|---|
| IDENTITY_STATUS | ACTIVE, SUSPENDED, DISABLED, PENDING |
| IDENTITY_TYPE | HUMAN, SERVICE, WORKLOAD, AI_AGENT |
| IDENTITY_EMAIL_DOMAIN | example.com |
| ENTITLEMENT_RISK | LOW, MEDIUM, HIGH, CRITICAL |
| ENTITLEMENT_PRIVILEGED | true, false |

Operators are EQ, NEQ and IN. IN accepts comma-separated values. Comparisons are case-insensitive.

## Decision semantics

- Baseline and custom DENY results take precedence over every other outcome.
- REVIEW takes precedence over ALLOW.
- A custom ALLOW rule never bypasses an immutable baseline DENY or REVIEW control.
- ALLOW still follows the existing human approval workflow; the engine does not directly grant access.
- Custom policies are evaluated in priority order, then key order for deterministic ties.

The immutable baseline controls continue to block inactive identities, disabled entitlements, duplicate active grants and duplicate pending requests. Baseline risk, privileged and non-human identity rules continue to require human review.

## Database setup

The Prisma schema is at `apps/web/prisma/schema.prisma`. For a local development database, apply the updated schema with:

```bash
pnpm db:generate
pnpm db:push
```

No database migration is automatically applied to a hosted database by this feature or by CI. Before production rollout, generate and review a migration against a representative copy of the target database, back it up, and deploy the migration through the organization's controlled release process. Do not use `db push` as a production migration strategy.

## Important boundaries

- The simulation checks one selected identity/entitlement scenario. It is not proof of exhaustive condition coverage; operators should test representative positive and negative cases before enabling a policy.
- Custom policies are enforced for new access requests and re-evaluated at approval time. Existing grants are not continuously re-evaluated.
- Rules currently support the listed scalar attributes only. There is no nested boolean expression builder, group/role membership lookup, time-based condition, external signal or policy-as-code runtime.
- There is no external provisioning or revocation connector in this milestone.
- Version history is append-only at the application layer, not a tamper-proof/WORM storage guarantee.
- This feature does not constitute a compliance certification or production security guarantee. Review policy intent and test outcomes before operational use.
