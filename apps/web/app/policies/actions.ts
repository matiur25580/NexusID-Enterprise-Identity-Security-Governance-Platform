"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAccessPolicy } from "@/lib/policy-engine";

export type PolicySimulationState = { error?: string; result?: { outcome: string; summary: string; rules: { code: string; title: string; severity: string; outcome: string; explanation: string }[] } };

export async function simulateAccessPolicy(_prev: PolicySimulationState, formData: FormData): Promise<PolicySimulationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to run a policy simulation." };
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) return { error: "No organization workspace found." };
  const parsed = z.object({ identityId: z.string().min(1), entitlementId: z.string().min(1) }).safeParse({
    identityId: formData.get("identityId"),
    entitlementId: formData.get("entitlementId"),
  });
  if (!parsed.success) return { error: "Choose an identity and entitlement." };

  const [identity, entitlement] = await Promise.all([
    prisma.identity.findFirst({ where: { id: parsed.data.identityId, organizationId: membership.organizationId }, select: { id: true, status: true, type: true } }),
    prisma.entitlement.findFirst({ where: { id: parsed.data.entitlementId, organizationId: membership.organizationId }, select: { id: true, enabled: true, riskLevel: true, privileged: true } }),
  ]);
  if (!identity || !entitlement) return { error: "The selected resources do not belong to this workspace." };
  const [activeGrant, pendingRequest] = await Promise.all([
    prisma.accessGrant.findFirst({ where: { organizationId: membership.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.accessRequest.findFirst({ where: { organizationId: membership.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "PENDING" }, select: { id: true } }),
  ]);
  const result = evaluateAccessPolicy({
    identityStatus: identity.status,
    identityType: identity.type,
    entitlementEnabled: entitlement.enabled,
    riskLevel: entitlement.riskLevel,
    privileged: entitlement.privileged,
    hasActiveGrant: Boolean(activeGrant),
    hasPendingRequest: Boolean(pendingRequest),
  });
  await prisma.auditEvent.create({
    data: {
      organizationId: membership.organizationId,
      actorUserId: session.user.id,
      action: "policy.simulated",
      targetType: "policy_evaluation",
      outcome: result.outcome === "DENY" ? "DENIED" : "SUCCESS",
      reason: result.summary,
      metadata: {
        identityId: identity.id,
        entitlementId: entitlement.id,
        policyOutcome: result.outcome,
        matchedRules: result.rules.map((rule) => ({ code: rule.code, outcome: rule.outcome })),
      },
    },
  });
  return { result };
}
