"use server";

import { IdentityStatus, IdentityType, MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma, withTenantContext } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { calculateIdentityRisk } from "@/lib/identity-risk";
import { Prisma } from "@prisma/client";

const createIdentitySchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  externalId: z.string().trim().max(160).optional(),
  type: z.nativeEnum(IdentityType),
  source: z.string().trim().max(80).optional(),
});

const updateStatusSchema = z.object({
  identityId: z.string().min(1),
  status: z.nativeEnum(IdentityStatus),
});

const writeRoles: MembershipRole[] = ["OWNER", "ADMIN", "SECURITY_ANALYST"];

export type IdentityActionState = { error?: string; success?: string };

export async function createIdentity(
  _previous: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again." };

  const parsed = createIdentitySchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email") ?? "",
    externalId: formData.get("externalId") ?? "",
    type: formData.get("type"),
    source: formData.get("source") ?? "Manual",
  });
  if (!parsed.success) return { error: "Check the identity details and try again." };

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) return { error: "No organization workspace was found." };

  await requireOrganizationRole(membership.organizationId, writeRoles);

  try {
    await withTenantContext(membership.organizationId, async (tx) => {
      const identity = await tx.identity.create({
        data: {
          organizationId: membership.organizationId,
          displayName: parsed.data.displayName,
          email: parsed.data.email || null,
          externalId: parsed.data.externalId || null,
          type: parsed.data.type,
          source: parsed.data.source || "Manual",
          status: "PENDING",
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: membership.organizationId,
          actorUserId: session.user.id,
          action: "identity.created",
          targetType: "identity",
          targetId: identity.id,
          outcome: "SUCCESS",
          reason: "Identity added through the directory.",
          metadata: { type: identity.type, source: identity.source },
        },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "That external identity ID already exists in this workspace." };
    }
    throw error;
  }

  revalidatePath("/identities");
  return { success: "Identity added to the directory." };
}

export async function updateIdentityStatus(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Authentication required.");

  const parsed = updateStatusSchema.safeParse({
    identityId: formData.get("identityId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid identity status.");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) throw new Error("No organization workspace was found.");
  await requireOrganizationRole(membership.organizationId, writeRoles);

  await withTenantContext(membership.organizationId, async (tx) => {
    const identity = await tx.identity.findFirst({
      where: { id: parsed.data.identityId, organizationId: membership.organizationId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!identity) throw new Error("Identity not found.");
    if (identity.status === parsed.data.status) return;
    await tx.identity.update({
      where: { id: identity.id, organizationId: membership.organizationId },
      data: { status: parsed.data.status },
    });
    const revoked = parsed.data.status === "ACTIVE"
      ? { count: 0 }
      : await tx.accessGrant.updateMany({
          where: { organizationId: membership.organizationId, identityId: identity.id, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
    await tx.auditEvent.create({
      data: {
        organizationId: identity.organizationId,
        actorUserId: session.user.id,
        action: "identity.status_changed",
        targetType: "identity",
        targetId: identity.id,
        outcome: "SUCCESS",
        reason: parsed.data.status === "ACTIVE"
          ? "Identity status reactivated; previously revoked grants remain revoked pending a new approval."
          : "Identity status changed to a non-active state and all active access grants were revoked.",
        metadata: { previousStatus: identity.status, newStatus: parsed.data.status, grantsRevoked: revoked.count },
      },
    });;
  });

  revalidatePath("/identities");
}

export async function captureIdentityRiskSnapshots(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Authentication required.");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id }, orderBy: { createdAt: "asc" }, select: { organizationId: true },
  });
  if (!membership) throw new Error("No organization workspace was found.");
  await requireOrganizationRole(membership.organizationId, writeRoles);
  await withTenantContext(membership.organizationId, async (tx) => {
    const identities = await tx.identity.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true, status: true, type: true, lastSeenAt: true,
        accessGrants: { where: { organizationId: membership.organizationId, status: "ACTIVE" },
          select: { entitlement: { select: { riskLevel: true, privileged: true } } } } },
    });
    const now = new Date();
    const capturedOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const snapshots = identities.map((identity) => {
      const risk = calculateIdentityRisk({ status: identity.status, type: identity.type, lastSeenAt: identity.lastSeenAt,
        activeGrants: identity.accessGrants.map((grant) => grant.entitlement) }, now);
      return { organizationId: membership.organizationId, identityId: identity.id, score: risk.score,
        level: risk.level, factors: risk.factors as Prisma.InputJsonArray, methodology: risk.methodology, capturedOn };
    });
    if (snapshots.length) await tx.identityRiskSnapshot.createMany({ data: snapshots, skipDuplicates: true });
    await tx.auditEvent.create({ data: {
      organizationId: membership.organizationId, actorUserId: session.user.id,
      action: "identity.risk_snapshot.captured", targetType: "identity_risk_snapshot",
      outcome: "SUCCESS", reason: "Daily identity risk snapshot captured.",
      metadata: { capturedOn: capturedOn.toISOString().slice(0, 10), identityCount: snapshots.length, methodology: "NEXUSID_DETERMINISTIC_V1" },
    } });
  });
  revalidatePath("/identities");
}
