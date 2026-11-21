export type PolicyOutcome = "ALLOW" | "REVIEW" | "DENY";
export type PolicyRuleResult = {
  code: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  outcome: PolicyOutcome;
  explanation: string;
};

export type AccessPolicyInput = {
  identityStatus: string;
  identityType: string;
  entitlementEnabled: boolean;
  riskLevel: string;
  privileged: boolean;
  hasActiveGrant?: boolean;
  hasPendingRequest?: boolean;
};

export type AccessPolicyResult = {
  outcome: PolicyOutcome;
  rules: PolicyRuleResult[];
  summary: string;
};

/**
 * Deterministic, explainable baseline policy evaluation.
 * This module is intentionally pure so request flows and simulations share
 * identical policy semantics. It never provisions access.
 */
export function evaluateAccessPolicy(input: AccessPolicyInput): AccessPolicyResult {
  const rules: PolicyRuleResult[] = [];
  const add = (rule: PolicyRuleResult) => rules.push(rule);

  if (input.identityStatus !== "ACTIVE") add({
    code: "IDENTITY_NOT_ACTIVE", title: "Identity must be active", severity: "CRITICAL", outcome: "DENY",
    explanation: "Only active identities may receive access.",
  });
  if (!input.entitlementEnabled) add({
    code: "ENTITLEMENT_DISABLED", title: "Entitlement is disabled", severity: "CRITICAL", outcome: "DENY",
    explanation: "Disabled entitlements cannot be requested or granted.",
  });
  if (input.hasActiveGrant) add({
    code: "DUPLICATE_ACTIVE_GRANT", title: "Access already exists", severity: "CRITICAL", outcome: "DENY",
    explanation: "The identity already has an active grant for this entitlement.",
  });
  if (input.hasPendingRequest) add({
    code: "PENDING_REQUEST_EXISTS", title: "Request already pending", severity: "WARNING", outcome: "DENY",
    explanation: "A pending request already exists for this identity and entitlement.",
  });

  const risk = input.riskLevel.toUpperCase();
  if (risk === "CRITICAL") add({
    code: "CRITICAL_ENTITLEMENT", title: "Critical-risk entitlement", severity: "CRITICAL", outcome: "REVIEW",
    explanation: "Critical-risk access requires an explicit security reviewer decision.",
  });
  else if (risk === "HIGH") add({
    code: "HIGH_RISK_ENTITLEMENT", title: "High-risk entitlement", severity: "WARNING", outcome: "REVIEW",
    explanation: "High-risk access requires a documented human review.",
  });
  if (input.privileged) add({
    code: "PRIVILEGED_ACCESS", title: "Privileged access", severity: "WARNING", outcome: "REVIEW",
    explanation: "Privileged permissions require an explicit reviewer decision and rationale.",
  });
  if (input.identityType !== "HUMAN") add({
    code: "NON_HUMAN_IDENTITY", title: "Non-human identity", severity: "WARNING", outcome: "REVIEW",
    explanation: "Service, workload and AI-agent access requires a human reviewer to validate ownership and purpose.",
  });

  const outcome: PolicyOutcome = rules.some((rule) => rule.outcome === "DENY")
    ? "DENY"
    : rules.some((rule) => rule.outcome === "REVIEW") ? "REVIEW" : "ALLOW";
  return {
    outcome,
    rules,
    summary: outcome === "DENY"
      ? "Access is blocked by one or more mandatory controls."
      : outcome === "REVIEW"
        ? "Access may be requested, but requires explicit human approval."
        : "No elevated-risk rule matched. Standard approval workflow applies.",
  };
}
