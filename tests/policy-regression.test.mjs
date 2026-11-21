import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function loadTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
}
const [engine, guards, risk] = await Promise.all([
  loadTypeScript("../apps/web/lib/policy-engine.ts"), loadTypeScript("../apps/web/lib/policy-guards.ts"), loadTypeScript("../apps/web/lib/identity-risk.ts"),
]);
const safeInput = { identityStatus: "ACTIVE", identityType: "HUMAN", identityEmail: "alex@example.com", entitlementEnabled: true, riskLevel: "LOW", privileged: false, hasActiveGrant: false, hasPendingRequest: false };

test("immutable baseline DENY takes precedence over custom ALLOW", () => {
  const result = engine.evaluateAccessPolicy({ ...safeInput, identityStatus: "SUSPENDED", entitlementEnabled: false }, [
    { key: "OVERRIDE", name: "Attempted override", description: null, effect: "ALLOW", field: "IDENTITY_STATUS", operator: "EQ", value: "SUSPENDED", priority: 1, enabled: true },
  ]);
  assert.equal(result.outcome, "DENY");
  assert.ok(result.rules.some((rule) => rule.code === "IDENTITY_NOT_ACTIVE"));
  assert.ok(result.rules.some((rule) => rule.code === "ENTITLEMENT_DISABLED"));
});
test("baseline REVIEW controls cannot be lowered by custom ALLOW", () => {
  const result = engine.evaluateAccessPolicy({ ...safeInput, riskLevel: "CRITICAL", privileged: true, identityType: "AI_AGENT" }, [
    { key: "ALLOW_CRITICAL", name: "Custom allow", description: null, effect: "ALLOW", field: "ENTITLEMENT_RISK", operator: "EQ", value: "CRITICAL", priority: 1, enabled: true },
  ]);
  assert.equal(result.outcome, "REVIEW");
  assert.ok(result.rules.some((rule) => rule.code === "CRITICAL_ENTITLEMENT"));
  assert.ok(result.rules.some((rule) => rule.code === "PRIVILEGED_ACCESS"));
  assert.ok(result.rules.some((rule) => rule.code === "NON_HUMAN_IDENTITY"));
});
test("clean baseline ALLOW still follows the standard human approval workflow", () => {
  const result = engine.evaluateAccessPolicy(safeInput);
  assert.equal(result.outcome, "ALLOW");
  assert.match(result.summary, /Standard approval workflow/);
  assert.equal(guards.approvalMustBeBlocked(result.outcome), false);
});
test("custom DENY wins over REVIEW and ALLOW with deterministic priority ordering", () => {
  const rules = [
    { key: "Z_DENY", name: "Deny", description: null, effect: "DENY", field: "IDENTITY_EMAIL_DOMAIN", operator: "EQ", value: "example.com", priority: 20, enabled: true },
    { key: "A_REVIEW", name: "Review", description: null, effect: "REVIEW", field: "IDENTITY_EMAIL_DOMAIN", operator: "IN", value: "example.com,other.com", priority: 5, enabled: true },
    { key: "B_ALLOW", name: "Allow", description: null, effect: "ALLOW", field: "IDENTITY_STATUS", operator: "EQ", value: "ACTIVE", priority: 1, enabled: true },
    { key: "OFF", name: "Disabled", description: null, effect: "DENY", field: "IDENTITY_STATUS", operator: "EQ", value: "ACTIVE", priority: 0, enabled: false },
  ];
  const result = engine.evaluateAccessPolicy(safeInput, rules);
  assert.equal(result.outcome, "DENY");
  assert.deepEqual(result.rules.filter((rule) => rule.source === "CUSTOM").map((rule) => rule.code), ["CUSTOM_B_ALLOW", "CUSTOM_A_REVIEW", "CUSTOM_Z_DENY"]);
});
test("custom field matching supports EQ, NEQ and IN", () => {
  const rules = [
    { key: "EQ", name: "Eq", description: null, effect: "REVIEW", field: "IDENTITY_EMAIL_DOMAIN", operator: "EQ", value: "example.com", priority: 1, enabled: true },
    { key: "NEQ", name: "Neq", description: null, effect: "REVIEW", field: "IDENTITY_TYPE", operator: "NEQ", value: "SERVICE", priority: 2, enabled: true },
    { key: "IN", name: "In", description: null, effect: "REVIEW", field: "ENTITLEMENT_RISK", operator: "IN", value: "LOW,HIGH", priority: 3, enabled: true },
  ];
  const result = engine.evaluateAccessPolicy(safeInput, rules);
  assert.deepEqual(result.rules.filter((rule) => rule.source === "CUSTOM").map((rule) => rule.code), ["CUSTOM_EQ", "CUSTOM_NEQ", "CUSTOM_IN"]);
});
test("invalid persisted field, operator and outcome data fail closed without crashing", () => {
  const invalid = [
    { key: "BAD_FIELD", name: "Bad field", description: null, effect: "DENY", field: "UNSUPPORTED_FIELD", operator: "EQ", value: "x", priority: 1, enabled: true },
    { key: "BAD_OPERATOR", name: "Bad operator", description: null, effect: "DENY", field: "IDENTITY_STATUS", operator: "EXEC", value: "ACTIVE", priority: 2, enabled: true },
    { key: "BAD_EFFECT", name: "Bad effect", description: null, effect: "EXECUTE", field: "IDENTITY_STATUS", operator: "EQ", value: "ACTIVE", priority: 3, enabled: true },
  ];
  const result = engine.evaluateAccessPolicy(safeInput, invalid);
  assert.equal(result.outcome, "ALLOW");
  assert.equal(result.rules.length, 0);
});
test("activation requires simulation of the exact current policy version", () => {
  assert.equal(guards.hasFreshPolicySimulation({ version: 3, validatedVersion: 3 }), true);
  assert.equal(guards.hasFreshPolicySimulation({ version: 3, validatedVersion: 2 }), false);
  assert.equal(guards.hasFreshPolicySimulation({ version: 3, validatedVersion: null }), false);
  assert.equal(guards.hasFreshPolicySimulation({ version: 0, validatedVersion: 0 }), false);
});
test("approval-time re-evaluation blocks a newly denied identity", () => {
  const changedState = engine.evaluateAccessPolicy({ ...safeInput, identityStatus: "DISABLED" });
  assert.equal(guards.approvalMustBeBlocked(changedState.outcome), true);
  assert.equal(guards.approvalMustBeBlocked("REVIEW"), false);
  assert.equal(guards.approvalMustBeBlocked("ALLOW"), false);
});
test("tenant query scope cannot be overridden by untrusted filters", () => {
  assert.deepEqual(guards.tenantScopedWhere("tenant-a", { status: "ACTIVE", organizationId: "tenant-b" }), { status: "ACTIVE", organizationId: "tenant-a" });
});
test("identity risk is deterministic, capped and explains every contribution", () => {
  const asOf = new Date("2026-11-21T00:00:00.000Z");
  const input = { status: "SUSPENDED", type: "AI_AGENT", lastSeenAt: "2026-06-01T00:00:00.000Z", activeGrants: [
    { riskLevel: "CRITICAL", privileged: true }, { riskLevel: "CRITICAL", privileged: true }, { riskLevel: "HIGH", privileged: false },
  ] };
  const first = risk.calculateIdentityRisk(input, asOf);
  assert.deepEqual(first, risk.calculateIdentityRisk(input, asOf));
  assert.equal(first.score, 100);
  assert.equal(first.level, "CRITICAL");
  assert.ok(first.factors.some((factor) => factor.code === "CRITICAL_ACCESS"));
  assert.ok(first.factors.every((factor) => factor.points > 0 && factor.explanation.length > 0));
});
test("missing or invalid last-seen timestamps are neutral, not stale", () => {
  const asOf = new Date("2026-11-21T00:00:00Z");
  assert.equal(risk.calculateIdentityRisk({ status: "ACTIVE", type: "HUMAN" }, asOf).score, 0);
  assert.equal(risk.calculateIdentityRisk({ status: "ACTIVE", type: "HUMAN", lastSeenAt: "not-a-date" }, asOf).score, 0);
});
test("risk contribution caps prevent grant counts from exceeding 100", () => {
  const grants = Array.from({ length: 8 }, () => ({ riskLevel: "CRITICAL", privileged: true }));
  const result = risk.calculateIdentityRisk({ status: "ACTIVE", type: "HUMAN", activeGrants: grants }, new Date());
  assert.equal(result.score, 80);
  assert.equal(result.factors.find((factor) => factor.code === "CRITICAL_ACCESS")?.points, 50);
  assert.equal(result.factors.find((factor) => factor.code === "PRIVILEGED_ACCESS")?.points, 30);
});
