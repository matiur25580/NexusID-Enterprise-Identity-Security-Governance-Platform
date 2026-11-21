"use server";

import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma, withTenantContext } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

const reviewerRoles: MembershipRole[] = ["OWNER", "ADMIN", "SECURITY_ANALYST"];
type ActionState = { error?: string; success?: string };

async function actorContext() {
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

const campaignSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1500).optional(),
  dueAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), "Due date must be in the future."),
});

export async function createCertificationCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorContext();
  await requireOrganizationRole(actor.organizationId, reviewerRoles);
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) return { error: "Enter a campaign name and a future due date." };

  const activeGrants = await prisma.accessGrant.findMany({
    where: { organizationId: actor.organizationId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { grantedAt: "asc" },
  });
  if (activeGrants.length === 0) return { error: "There are no active grants to certify. Approve access requests first." };

  const campaign = await withTenantContext(actor.organizationId, async (tx) => {
    const created = await tx.certificationCampaign.create({
      data: {
        organizationId: actor.organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        dueAt: parsed.data.dueAt,
        createdById: actor.userId,
        items: { create: activeGrants.map((grant) => ({ grantId: grant.id })) },
      },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "certification.campaign.created",
        targetType: "certification_campaign",
        targetId: created.id,
        outcome: "SUCCESS",
        metadata: { grantCount: activeGrants.length, dueAt: parsed.data.dueAt.toISOString() },
      },
    });
    return created;
  });
  revalidatePath("/certifications");
  return { success: `Campaign created with ${activeGrants.length} access items.` };
}

const decisionSchema = z.object({
  itemId: z.string().min(1),
  decision: z.enum(["CERTIFIED", "REVOKED"]),
  reason: z.string().trim().min(5).max(1200),
});

export async function decideCertificationItem(formData: FormData): Promise<void> {
  const actor = await actorContext();
  await requireOrganizationRole(actor.organizationId, reviewerRoles);
  const parsed = decisionSchema.safeParse({
    itemId: formData.get("itemId"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) throw new Error("Provide a valid certification decision and rationale.");

  const item = await prisma.certificationItem.findFirst({
    where: { id: parsed.data.itemId, campaign: { organizationId: actor.organizationId, status: "IN_PROGRESS" } },
    include: { campaign: true, grant: { include: { identity: true, entitlement: { include: { application: true } } } } },
  });
  if (!item) throw new Error("Certification item not found or its campaign is no longer active.");
  if (item.status !== "PENDING") throw new Error("This item has already been reviewed.");
  if (item.grant.status !== "ACTIVE" && parsed.data.decision === "CERTIFIED") {
    throw new Error("This grant is no longer active. Record it as revoked instead.");
  }

  await withTenantContext(actor.organizationId, async (tx) => {
    const updated = await tx.certificationItem.updateMany({
      where: { id: item.id, campaignId: item.campaignId, status: "PENDING" },
      data: {
        status: parsed.data.decision,
        reviewerId: actor.userId,
        decisionReason: parsed.data.reason,
        decidedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("This item was already reviewed by another reviewer.");

    if (parsed.data.decision === "REVOKED" && item.grant.status === "ACTIVE") {
      const revoked = await tx.accessGrant.updateMany({
        where: { id: item.grantId, organizationId: actor.organizationId, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new Error("The grant is no longer active.");
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "access.revoked",
          targetType: "access_grant",
          targetId: item.grantId,
          outcome: "SUCCESS",
          reason: parsed.data.reason,
          metadata: { source: "access_certification", campaignId: item.campaignId, identityId: item.grant.identityId, entitlementId: item.grant.entitlementId },
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: parsed.data.decision === "CERTIFIED" ? "certification.access.certified" : "certification.access.revoked",
        targetType: "certification_item",
        targetId: item.id,
        outcome: "SUCCESS",
        reason: parsed.data.reason,
        metadata: { campaignId: item.campaignId, grantId: item.grantId },
      },
    });

    const remaining = await tx.certificationItem.count({ where: { campaignId: item.campaignId, status: "PENDING" } });
    if (remaining === 0) {
      await tx.certificationCampaign.updateMany({
        where: { id: item.campaignId, status: "IN_PROGRESS" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "certification.campaign.completed",
          targetType: "certification_campaign",
          targetId: item.campaignId,
          outcome: "SUCCESS",
        },
      });
    }
  });

  revalidatePath("/certifications");
  revalidatePath("/governance");
}
