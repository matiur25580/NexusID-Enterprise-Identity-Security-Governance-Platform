# Policy evaluation engine

NexusID includes a deterministic baseline access-policy evaluator shared by request workflows and the Policy Studio simulation.

## Outcomes

- **DENY** — a mandatory control blocks the request.
- **REVIEW** — access can be requested but requires explicit human approval.
- **ALLOW** — no elevated-risk baseline rule matched; the normal human approval workflow still applies.

The engine prioritizes outcomes in this order: DENY, REVIEW, ALLOW. It does not grant access or provision an external system.

## Baseline rules

| Rule | Outcome | Rationale |
|---|---|---|
| Identity not active | DENY | Only active identities may receive access |
| Entitlement disabled | DENY | Disabled catalog entries cannot be granted |
| Duplicate active grant | DENY | Prevents duplicate access assignments |
| Pending request exists | DENY | Prevents duplicate open requests |
| Critical-risk entitlement | REVIEW | Requires explicit security review |
| High-risk entitlement | REVIEW | Requires documented human approval |
| Privileged access | REVIEW | Requires an explicit reviewer decision |
| Non-human identity | REVIEW | Requires validation of owner and purpose |

## Enforcement

The access-request workflow evaluates identity state, entitlement state, risk, privilege and existing assignments before creating a request. Denied requests are blocked and generate an audit event. Successful request events retain the policy outcome and matched rule evidence in audit metadata.

The Policy Studio at `/policies` runs the same evaluator against tenant-scoped identities and entitlements and records each simulation in the audit trail.

## Security boundaries and limitations

- Every non-denied access request still requires an authorized human approval.
- Policy definitions are currently code-based baseline rules, not customer-editable policy records.
- There is no automatic provisioning, external enforcement point or continuous re-evaluation of already granted access.
- Risk levels are catalog metadata; no machine-learning risk score is inferred.
- The policy simulator is advisory and does not mutate grants.
- This baseline is not a compliance certification or production security guarantee. Review and test the rules against your organization's requirements before operational use.
