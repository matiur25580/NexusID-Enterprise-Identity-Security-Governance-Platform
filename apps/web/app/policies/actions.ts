"use server";

import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma, withTenantContext } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { evaluateAccessPolicy, type ConfigurablePolicyRule } from "@/lib/policy-engine";
import { hasFreshPolicySimulation, tenantScopedWhere } from "@/lib/policy-guards";

const policyManagers: MembershipRole[] = ["OWNER", "ADMIN", "SECURITY_ANALYST"];
export type PolicySimulationState = { error?: string; result?: { outcome: string; summary: string; rules: { code: string; title: string; severity: string; outcome: string; explanation: string; source?: string }[] } };
export type PolicyActionState = { error?: string; success?: string };

async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Authentication required.");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id }, orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) throw new Error("No organization workspace found.");
  await requireOrganizationRole(membership.organizationId, policyManagers);
  return { userId: session.user.id, organizationId: membership.organizationId };
}

const policySchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  effect: z.enum(["DENY", "REVIEW", "ALLOW"]),
  field: z.enum(["IDENTITY_STATUS", "IDENTITY_TYPE", "IDENTITY_EMAIL_DOMAIN", "ENTITLEMENT_RISK", "ENTITLEMENT_PRIVILEGED"]),
  operator: z.enum(["EQ", "NEQ", "IN"]),
  value: z.string().trim().min(1).max(200),
  priority: z.coerce.number().int().min(1).max(10000),
});

function snapshot(rule: { key: string; name: string; description: string | null; effect: string; field: string; operator: string; value: string; priority: number; enabled: boolean }) {
  return { key: rule.key, name: rule.name, description: rule.description, effect: rule.effect, field: rule.field, operator: rule.operator, value: rule.value, priority: rule.priority, enabled: rule.enabled };
}

export async function createPolicyRule(_prev: PolicyActionState, formData: FormData): Promise<PolicyActionState> {
  const actor = await currentActor();
  const parsed = policySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the policy fields. Use a supported condition and valid priority." };
  const data = parsed.data;
  try {
    await withTenantContext(actor.organizationId, async (tx) => {
      const rule = await tx.policyRule.create({ data: {
        organizationId: actor.organizationId, key: data.key.toUpperCase(), name: data.name,
        description: data.description || null, effect: data.effect, field: data.field,
        operator: data.operator, value: data.value, priority: data.priority, enabled: false,
      } });
      await tx.policyRuleVersion.create({ data: {
        policyRuleId: rule.id, version: 1, snapshot: snapshot(rule), changeNote: "Created as draft", changedById: actor.userId,
      } });
      await tx.auditEvent.create({ data: {
        organizationId: actor.organizationId, actorUserId: actor.userId, action: "policy.rule.created",
        targetType: "policy_rule", targetId: rule.id, outcome: "SUCCESS",
        metadata: { key: rule.key, version: 1, status: "DRAFT" },
      } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "A policy with that key already exists in this workspace." };
    throw error;
  }
  revalidatePath("/policies");
  return { success: "Policy draft created. Run a simulation before enabling it." };
}

export async function updatePolicyRule(_prev: PolicyActionState, formData: FormData): Promise<PolicyActionState> {
  const actor = await currentActor();
  const parsed = policySchema.extend({ ruleId: z.string().min(1), changeNote: z.string().trim().min(5).max(300) })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the policy fields and provide a change note of at least 5 characters." };
  const { ruleId, changeNote, ...data } = parsed.data;
  const existing = await prisma.policyRule.findFirst({ where: { id: ruleId, organizationId: actor.organizationId } });
  if (!existing) return { error: "Policy rule not found in this workspace." };
  if (existing.enabled) return { error: "Disable the policy before editing it. This prevents silent changes to active enforcement." };
  try {
    await withTenantContext(actor.organizationId, async (tx) => {
      const changed = await tx.policyRule.updateMany({ where: {
        id: existing.id, organizationId: actor.organizationId, version: existing.version, enabled: false,
      }, data: {
        key: data.key.toUpperCase(), name: data.name, description: data.description || null,
        effect: data.effect, field: data.field, operator: data.operator, value: data.value,
        priority: data.priority, version: { increment: 1 }, lastSimulatedAt: null, validatedVersion: null,
      } });
      if (changed.count !== 1) throw new Error("This policy changed in another session. Reload it and try again.");
      const updated = await tx.policyRule.findUniqueOrThrow({ where: { id: existing.id } });
      await tx.policyRuleVersion.create({ data: {
        policyRuleId: updated.id, version: updated.version, snapshot: snapshot(updated),
        changeNote, changedById: actor.userId,
      } });
      await tx.auditEvent.create({ data: {
        organizationId: actor.organizationId, actorUserId: actor.userId, action: "policy.rule.updated",
        targetType: "policy_rule", targetId: updated.id, outcome: "SUCCESS", reason: changeNote,
        metadata: { key: updated.key, version: updated.version },
      } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "A policy with that key already exists." };
    throw error;
  }
  revalidatePath("/policies");
  return { success: "Draft updated and version history recorded." };
}

export async function setPolicyRuleEnabled(formData: FormData): Promise<void> {
  const actor = await currentActor();
  const parsed = z.object({ ruleId: z.string().min(1), enabled: z.enum(["true", "false"]) }).safeParse({
    ruleId: formData.get("ruleId"), enabled: formData.get("enabled"),
  });
  if (!parsed.success) throw new Error("Invalid policy activation request.");
  const rule = await prisma.policyRule.findFirst({ where: { id: parsed.data.ruleId, organizationId: actor.organizationId } });
  if (!rule) throw new Error("Policy rule not found.");
  const enabled = parsed.data.enabled === "true";
  if (enabled && !hasFreshPolicySimulation(rule)) {
    throw new Error("Run a policy simulation after the latest edit before enabling this rule.");
  }
  await withTenantContext(actor.organizationId, async (tx) => {
    const changed = await tx.policyRule.updateMany({ where: {
      id: rule.id, organizationId: actor.organizationId, version: rule.version, enabled: rule.enabled,
      ...(enabled ? { validatedVersion: rule.version } : {}),
    }, data: { enabled, version: { increment: 1 }, validatedVersion: null } });
    if (changed.count !== 1) throw new Error("The policy changed or needs a fresh simulation. Reload and try again.");
    const updated = await tx.policyRule.findUniqueOrThrow({ where: { id: rule.id } });
    await tx.policyRuleVersion.create({ data: {
      policyRuleId: updated.id, version: updated.version, snapshot: snapshot(updated),
      changeNote: enabled ? "Enabled after simulation" : "Disabled by policy manager", changedById: actor.userId,
    } });
    await tx.auditEvent.create({ data: {
      organizationId: actor.organizationId, actorUserId: actor.userId,
      action: enabled ? "policy.rule.enabled" : "policy.rule.disabled", targetType: "policy_rule",
      targetId: rule.id, outcome: "SUCCESS", metadata: { key: rule.key, version: rule.version },
    } });
  });
  revalidatePath("/policies");
}

export async function simulateAccessPolicy(_prev: PolicySimulationState, formData: FormData): Promise<PolicySimulationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to run a policy simulation." };
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id }, orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });
  if (!membership) return { error: "No organization workspace found." };
  if (!policyManagers.includes(membership.role)) return { error: "Only policy managers can run activation-gating simulations." };
  const parsed = z.object({ identityId: z.string().min(1), entitlementId: z.string().min(1) }).safeParse({
    identityId: formData.get("identityId"), entitlementId: formData.get("entitlementId"),
  });
  if (!parsed.success) return { error: "Choose an identity and entitlement." };
  const [identity, entitlement, policyRecords] = await Promise.all([
    prisma.identity.findFirst({ where: tenantScopedWhere(membership.organizationId, { id: parsed.data.identityId }), select: { id: true, status: true, type: true, email: true } }),
    prisma.entitlement.findFirst({ where: tenantScopedWhere(membership.organizationId, { id: parsed.data.entitlementId }), select: { id: true, enabled: true, riskLevel: true, privileged: true } }),
    prisma.policyRule.findMany({ where: tenantScopedWhere(membership.organizationId, {}), orderBy: [{ priority: "asc" }, { key: "asc" }] }),
  ]);
  if (!identity || !entitlement) return { error: "The selected resources do not belong to this workspace." };
  const [activeGrant, pendingRequest] = await Promise.all([
    prisma.accessGrant.findFirst({ where: { organizationId: membership.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.accessRequest.findFirst({ where: { organizationId: membership.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "PENDING" }, select: { id: true } }),
  ]);
  const candidates: ConfigurablePolicyRule[] = policyRecords.map((rule) => ({ ...rule, enabled: true }));
  const result = evaluateAccessPolicy({
    identityStatus: identity.status, identityType: identity.type, identityEmail: identity.email,
    entitlementEnabled: entitlement.enabled, riskLevel: entitlement.riskLevel, privileged: entitlement.privileged,
    hasActiveGrant: Boolean(activeGrant), hasPendingRequest: Boolean(pendingRequest),
  }, candidates);
  await withTenantContext(membership.organizationId, async (tx) => {
    const simulatedAt = new Date();
    for (const rule of policyRecords) {
      await tx.policyRule.update({ where: { id: rule.id }, data: { lastSimulatedAt: simulatedAt, validatedVersion: rule.version } });
    }
    await tx.auditEvent.create({ data: {
      organizationId: membership.organizationId, actorUserId: session.user.id, action: "policy.simulated",
      targetType: "policy_evaluation", outcome: result.outcome === "DENY" ? "DENIED" : "SUCCESS",
      reason: result.summary,
      metadata: { identityId: identity.id, entitlementId: entitlement.id, policyOutcome: result.outcome,
        matchedRules: result.rules.map((rule) => ({ code: rule.code, outcome: rule.outcome })) },
    } });
  });
  revalidatePath("/policies");
  return { result };
}
