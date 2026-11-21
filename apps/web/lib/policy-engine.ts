export type PolicyOutcome = "ALLOW" | "REVIEW" | "DENY";
export type PolicyRuleResult = {
  code: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  outcome: PolicyOutcome;
  explanation: string;
  source?: "BASELINE" | "CUSTOM";
};
export type ConfigurablePolicyRule = {
  key: string;
  name: string;
  description: string | null;
  effect: PolicyOutcome;
  field: string;
  operator: string;
  value: string;
  priority: number;
  enabled: boolean;
};
export type AccessPolicyInput = {
  identityStatus: string;
  identityType: string;
  identityEmail?: string | null;
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

function matches(value: string, operator: string, expected: string): boolean {
  const actual = value.toLowerCase();
  const target = expected.toLowerCase();
  if (operator === "EQ") return actual === target;
  if (operator === "NEQ") return actual !== target;
  if (operator === "IN") return target.split(",").map((part) => part.trim()).filter(Boolean).includes(actual);
  return false;
}
function fieldValue(input: AccessPolicyInput, field: string): string {
  switch (field) {
    case "IDENTITY_STATUS": return input.identityStatus;
    case "IDENTITY_TYPE": return input.identityType;
    case "IDENTITY_EMAIL_DOMAIN": return input.identityEmail?.split("@").at(-1) ?? "";
    case "ENTITLEMENT_RISK": return input.riskLevel;
    case "ENTITLEMENT_PRIVILEGED": return String(input.privileged);
    default: return "";
  }
}

/** Pure, deterministic evaluator shared by simulation, request and approval flows. */
export function evaluateAccessPolicy(input: AccessPolicyInput, customRules: ConfigurablePolicyRule[] = []): AccessPolicyResult {
  const rules: PolicyRuleResult[] = [];
  const add = (rule: PolicyRuleResult) => rules.push(rule);
  if (input.identityStatus !== "ACTIVE") add({ code: "IDENTITY_NOT_ACTIVE", title: "Identity must be active", severity: "CRITICAL", outcome: "DENY", explanation: "Only active identities may receive access.", source: "BASELINE" });
  if (!input.entitlementEnabled) add({ code: "ENTITLEMENT_DISABLED", title: "Entitlement is disabled", severity: "CRITICAL", outcome: "DENY", explanation: "Disabled entitlements cannot be requested or granted.", source: "BASELINE" });
  if (input.hasActiveGrant) add({ code: "DUPLICATE_ACTIVE_GRANT", title: "Access already exists", severity: "CRITICAL", outcome: "DENY", explanation: "The identity already has an active grant for this entitlement.", source: "BASELINE" });
  if (input.hasPendingRequest) add({ code: "PENDING_REQUEST_EXISTS", title: "Request already pending", severity: "WARNING", outcome: "DENY", explanation: "A pending request already exists for this identity and entitlement.", source: "BASELINE" });
  const risk = input.riskLevel.toUpperCase();
  if (risk === "CRITICAL") add({ code: "CRITICAL_ENTITLEMENT", title: "Critical-risk entitlement", severity: "CRITICAL", outcome: "REVIEW", explanation: "Critical-risk access requires an explicit security reviewer decision.", source: "BASELINE" });
  else if (risk === "HIGH") add({ code: "HIGH_RISK_ENTITLEMENT", title: "High-risk entitlement", severity: "WARNING", outcome: "REVIEW", explanation: "High-risk access requires a documented human review.", source: "BASELINE" });
  if (input.privileged) add({ code: "PRIVILEGED_ACCESS", title: "Privileged access", severity: "WARNING", outcome: "REVIEW", explanation: "Privileged permissions require an explicit reviewer decision and rationale.", source: "BASELINE" });
  if (input.identityType !== "HUMAN") add({ code: "NON_HUMAN_IDENTITY", title: "Non-human identity", severity: "WARNING", outcome: "REVIEW", explanation: "Service, workload and AI-agent access requires a human reviewer to validate ownership and purpose.", source: "BASELINE" });

  const ordered = [...customRules].filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  for (const rule of ordered) {
    if (matches(fieldValue(input, rule.field), rule.operator, rule.value)) {
      add({
        code: "CUSTOM_" + rule.key,
        title: rule.name,
        severity: rule.effect === "DENY" ? "CRITICAL" : rule.effect === "REVIEW" ? "WARNING" : "INFO",
        outcome: rule.effect,
        explanation: rule.description || `Matched configurable rule ${rule.key}.`,
        source: "CUSTOM",
      });
    }
  }
  const outcome: PolicyOutcome = rules.some((rule) => rule.outcome === "DENY") ? "DENY"
    : rules.some((rule) => rule.outcome === "REVIEW") ? "REVIEW" : "ALLOW";
  return {
    outcome, rules,
    summary: outcome === "DENY" ? "Access is blocked by one or more mandatory controls."
      : outcome === "REVIEW" ? "Access may be requested, but requires explicit human approval."
      : "No elevated-risk rule matched. Standard approval workflow applies.",
  };
}
