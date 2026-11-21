"use server";

import { AccessRequestStatus, MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { evaluateAccessPolicy } from "@/lib/policy-engine";

const managerRoles: MembershipRole[] = ["OWNER", "ADMIN", "SECURITY_ANALYST"];
export type GovernanceActionState = { error?: string; success?: string };

async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Authentication required.");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });
  if (!membership) throw new Error("No organization workspace found.");
  return { userId: session.user.id, ...membership };
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  ownerTeam: z.string().trim().max(100).optional(),
});

const entitlementSchema = z.object({
  applicationId: z.string().min(1),
  key: z.string().trim().min(2).max(100).regex(/^[A-Za-z0-9._:-]+$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  privileged: z.enum(["true", "false"]),
});

const requestSchema = z.object({
  identityId: z.string().min(1),
  entitlementId: z.string().min(1),
  requestReason: z.string().trim().min(10).max(1500),
});

export async function createApplication(_prev: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  const actor = await currentActor();
  await requireOrganizationRole(actor.organizationId, managerRoles);
  const parsed = applicationSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
    ownerTeam: formData.get("ownerTeam") || "",
  });
  if (!parsed.success) return { error: "Enter a valid application name and check the optional fields." };
  const slug = slugify(parsed.data.name);
  if (!slug) return { error: "Application name must include letters or numbers." };

  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          organizationId: actor.organizationId,
          name: parsed.data.name,
          slug,
          description: parsed.data.description || null,
          ownerTeam: parsed.data.ownerTeam || null,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "application.created",
          targetType: "application",
          targetId: app.id,
          outcome: "SUCCESS",
          metadata: { slug: app.slug },
        },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "An application with that name already exists." };
    throw error;
  }
  revalidatePath("/governance");
  return { success: "Application created." };
}

export async function createEntitlement(_prev: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  const actor = await currentActor();
  await requireOrganizationRole(actor.organizationId, managerRoles);
  const parsed = entitlementSchema.safeParse({
    applicationId: formData.get("applicationId"),
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") || "",
    riskLevel: formData.get("riskLevel"),
    privileged: formData.get("privileged"),
  });
  if (!parsed.success) return { error: "Check the entitlement details and try again." };

  const application = await prisma.application.findFirst({
    where: { id: parsed.data.applicationId, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (!application) return { error: "Choose an application in your workspace." };

  try {
    await prisma.$transaction(async (tx) => {
      const entitlement = await tx.entitlement.create({
        data: {
          organizationId: actor.organizationId,
          applicationId: application.id,
          key: parsed.data.key,
          name: parsed.data.name,
          description: parsed.data.description || null,
          riskLevel: parsed.data.riskLevel,
          privileged: parsed.data.privileged === "true",
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "entitlement.created",
          targetType: "entitlement",
          targetId: entitlement.id,
          outcome: "SUCCESS",
          metadata: { key: entitlement.key, riskLevel: entitlement.riskLevel, privileged: entitlement.privileged },
        },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "That entitlement key already exists for this application." };
    throw error;
  }
  revalidatePath("/governance");
  return { success: "Entitlement added to the catalog." };
}

export async function submitAccessRequest(_prev: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  const actor = await currentActor();
  if (actor.role === "AUDITOR") return { error: "Auditor accounts cannot request access." };
  const parsed = requestSchema.safeParse({ identityId: formData.get("identityId"), entitlementId: formData.get("entitlementId"), requestReason: formData.get("requestReason") });
  if (!parsed.success) return { error: "Provide an identity, entitlement and a reason of at least 10 characters." };
  const [identity, entitlement] = await Promise.all([
    prisma.identity.findFirst({ where: { id: parsed.data.identityId, organizationId: actor.organizationId }, select: { id: true, status: true, type: true, email: true } }),
    prisma.entitlement.findFirst({ where: { id: parsed.data.entitlementId, organizationId: actor.organizationId }, select: { id: true, enabled: true, riskLevel: true, privileged: true } }),
  ]);
  if (!identity || !entitlement) return { error: "Choose an identity and entitlement in your workspace." };
  const [activeGrant, pendingRequest] = await Promise.all([
    prisma.accessGrant.findFirst({ where: { organizationId: actor.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.accessRequest.findFirst({ where: { organizationId: actor.organizationId, identityId: identity.id, entitlementId: entitlement.id, status: "PENDING" }, select: { id: true } }),
  ]);
  const activePolicies = await prisma.policyRule.findMany({ where: { organizationId: actor.organizationId, enabled: true }, orderBy: [{ priority: "asc" }, { key: "asc" }] });
  const evaluation = evaluateAccessPolicy({ identityStatus: identity.status, identityType: identity.type, identityEmail: identity.email, entitlementEnabled: entitlement.enabled, riskLevel: entitlement.riskLevel, privileged: entitlement.privileged, hasActiveGrant: Boolean(activeGrant), hasPendingRequest: Boolean(pendingRequest) }, activePolicies);
  if (evaluation.outcome === "DENY") {
    await prisma.auditEvent.create({ data: {
      organizationId: actor.organizationId, actorUserId: actor.userId, action: "policy.access_request.denied",
      targetType: "policy_evaluation", outcome: "DENIED", reason: evaluation.summary,
      metadata: { identityId: identity.id, entitlementId: entitlement.id, policyOutcome: evaluation.outcome, matchedRules: evaluation.rules.map((rule) => ({ code: rule.code, explanation: rule.explanation })) },
    } });
    return { error: evaluation.summary + " " + evaluation.rules.map((rule) => rule.title).join("; ") };
  }
  await prisma.$transaction(async (tx) => {
    const request = await tx.accessRequest.create({ data: {
      organizationId: actor.organizationId, identityId: identity.id, entitlementId: entitlement.id,
      requesterUserId: actor.userId, requestReason: parsed.data.requestReason,
    } });
    await tx.auditEvent.create({ data: {
      organizationId: actor.organizationId, actorUserId: actor.userId, action: "access.requested",
      targetType: "access_request", targetId: request.id, outcome: "SUCCESS", reason: parsed.data.requestReason,
      metadata: { policyOutcome: evaluation.outcome, policySummary: evaluation.summary, matchedRules: evaluation.rules.map((rule) => ({ code: rule.code, outcome: rule.outcome, explanation: rule.explanation })) },
    } });
  });
  revalidatePath("/governance");
  return { success: evaluation.outcome === "REVIEW"
    ? "Request submitted for explicit human review: " + evaluation.rules.map((rule) => rule.title).join(", ")
    : "Access request submitted for standard approval." };
}

const decisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().trim().min(5).max(1000),
});

export async function decideAccessRequest(formData: FormData): Promise<void> {
  const actor = await currentActor();
  const parsed = decisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionReason: formData.get("decisionReason"),
  });
  if (!parsed.success) throw new Error("Provide a valid decision and a reason.");
  const request = await prisma.accessRequest.findFirst({
    where: { id: parsed.data.requestId, organizationId: actor.organizationId },
    include: { identity: true, entitlement: true },
  });
  if (!request) throw new Error("Access request not found.");
  await requireOrganizationRole(request.organizationId, managerRoles);
  if (request.requesterUserId === actor.userId) throw new Error("You cannot approve or reject your own access request.");
  if (request.status !== AccessRequestStatus.PENDING) throw new Error("This request has already been decided.");

  if (parsed.data.decision === "APPROVED") {
    const activeGrant = await prisma.accessGrant.findFirst({
      where: { organizationId: actor.organizationId, identityId: request.identityId, entitlementId: request.entitlementId, status: "ACTIVE" },
      select: { id: true },
    });
    const activePolicies = await prisma.policyRule.findMany({
      where: { organizationId: actor.organizationId, enabled: true },
      orderBy: [{ priority: "asc" }, { key: "asc" }],
    });
    const evaluation = evaluateAccessPolicy({
      identityStatus: request.identity.status,
      identityType: request.identity.type,
      identityEmail: request.identity.email,
      entitlementEnabled: request.entitlement.enabled,
      riskLevel: request.entitlement.riskLevel,
      privileged: request.entitlement.privileged,
      hasActiveGrant: Boolean(activeGrant),
    }, activePolicies);
    if (evaluation.outcome === "DENY") throw new Error(evaluation.summary + " " + evaluation.rules.map((rule) => rule.title).join("; "));
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.accessRequest.updateMany({
      where: { id: request.id, organizationId: actor.organizationId, status: "PENDING" },
      data: {
        status: parsed.data.decision,
        decisionUserId: actor.userId,
        decisionReason: parsed.data.decisionReason,
        decidedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("This request was already decided by another reviewer.");
    if (parsed.data.decision === "APPROVED") {
      const existingGrant = await tx.accessGrant.findFirst({
        where: { organizationId: actor.organizationId, identityId: request.identityId, entitlementId: request.entitlementId, status: "ACTIVE" },
        select: { id: true },
      });
      if (existingGrant) throw new Error("This identity already has an active grant.");
      await tx.accessGrant.create({
        data: {
          organizationId: actor.organizationId,
          identityId: request.identityId,
          entitlementId: request.entitlementId,
          requestId: request.id,
          grantedById: actor.userId,
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: parsed.data.decision === "APPROVED" ? "access.approved" : "access.rejected",
        targetType: "access_request",
        targetId: request.id,
        outcome: "SUCCESS",
        reason: parsed.data.decisionReason,
        metadata: { identityId: request.identityId, entitlementId: request.entitlementId },
      },
    });
  });
  revalidatePath("/governance");
}

export async function revokeAccessGrant(formData: FormData): Promise<void> {
  const actor = await currentActor();
  const grantId = z.string().min(1).parse(formData.get("grantId"));
  const grant = await prisma.accessGrant.findFirst({
    where: { id: grantId, organizationId: actor.organizationId, status: "ACTIVE" },
    select: { id: true, organizationId: true, identityId: true, entitlementId: true },
  });
  if (!grant) throw new Error("Active access grant not found.");
  await requireOrganizationRole(grant.organizationId, managerRoles);
  await prisma.$transaction(async (tx) => {
    await tx.accessGrant.update({ where: { id: grant.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.auditEvent.create({
      data: {
        organizationId: grant.organizationId,
        actorUserId: actor.userId,
        action: "access.revoked",
        targetType: "access_grant",
        targetId: grant.id,
        outcome: "SUCCESS",
        reason: "Access revoked by an authorized workspace operator.",
        metadata: { identityId: grant.identityId, entitlementId: grant.entitlementId },
      },
    });
  });
  revalidatePath("/governance");
}
