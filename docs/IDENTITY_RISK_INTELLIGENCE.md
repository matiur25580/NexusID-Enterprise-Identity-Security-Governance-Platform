# Identity risk intelligence

NexusID displays an explainable, deterministic identity risk score in the identity directory. It is a triage heuristic, not a probability, predictive model, ML output, compliance rating or automatic access decision.

## Version 1 scoring

Signals are additive and the final score is capped at 100.

| Signal | Points | Rule |
|---|---:|---|
| Disabled identity | +50 | Status is DISABLED |
| Suspended identity | +35 | Status is SUSPENDED |
| Pending identity | +15 | Status is PENDING |
| Non-human identity | +15 | Type is SERVICE, WORKLOAD or AI_AGENT |
| Stale identity | +10 | A valid last-seen timestamp is more than 90 days old |
| Critical-risk active grants | +25 each, max +50 | Active grants for CRITICAL entitlements |
| High-risk active grants | +15 each, max +30 | Active grants for HIGH entitlements |
| Privileged active grants | +15 each, max +30 | Active grants marked privileged |
| High access volume | +10 | More than 10 active grants |

Levels: LOW (0–24), MODERATE (25–49), HIGH (50–74), CRITICAL (75–100).

The directory only loads active grants and related entitlement risk/privileged attributes. Missing or invalid last-seen timestamps are neutral; they do not imply stale activity. Every applied signal is exposed as a reason with its point contribution. One captured timestamp is used for all identities in a directory response.

## Operational boundaries

- Scores are triage aids for human investigation. They do not grant, deny, revoke or certify access.
- Weights are transparent starting defaults and are not calibrated against incident outcomes or an external risk dataset.
- The model does not include device posture, location, threat intelligence, authentication anomalies, ownership quality, business criticality or observed activity telemetry.
- Scores are recalculated when the directory is rendered; no score history or trend is stored.
- Directory queries remain scoped to the authenticated tenant and include only active grants.
- Validate and tune thresholds with security stakeholders before using scores in operational SLAs or compliance reporting.
