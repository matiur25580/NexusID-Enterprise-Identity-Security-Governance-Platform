# Scheduled risk assessments and escalation alerts

## Automation setup

GitHub Actions runs daily at 02:15 UTC and supports manual workflow dispatch. Configure repository Actions secrets `NEXUSID_APP_URL` (deployed app origin) and `NEXUSID_RISK_SNAPSHOT_SECRET` (at least 32 random characters). Configure the identical secret as a server-only application environment variable.

The workflow safely skips with a warning when secrets are missing. It POSTs to `/api/internal/risk-snapshots`. The endpoint rejects missing/invalid bearer credentials and uses constant-time comparison after validating token length.

## Assessment behavior

The endpoint processes each organization independently, loads its identities and active grants, calculates deterministic risk, stores one daily snapshot per identity, compares with the previous snapshot, persists alerts and records an organization-scoped audit event. Unique constraints make snapshot and alert writes idempotent per UTC day. Repeated calls can still create additional assessment audit events.

## Alert rules

- `CRITICAL_THRESHOLD`: current score >= 75 and previous score < 75.
- `RISK_SPIKE`: score increased by at least 15 points.
- First assessment compares against zero, so an already-critical identity is flagged.
- Both alerts may be recorded for one identity on one day.
- Alerts are informational and never modify access.

Email, Slack, PagerDuty, SIEM delivery and acknowledgement are not implemented.

## Database

Apply `apps/web/prisma/migrations/20261121113000_add_identity_risk_alerts/migration.sql` after reviewing it against the target schema and backing up. Do not use `db:push` against production. A formal migration baseline is still needed for the earlier schema-first history.
