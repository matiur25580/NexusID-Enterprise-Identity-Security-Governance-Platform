"use server";

import { IdentityStatus, IdentityType, MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

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
    await prisma.$transaction(async (tx) => {
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

  const identity = await prisma.identity.findUnique({
    where: { id: parsed.data.identityId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!identity) throw new Error("Identity not found.");

  await requireOrganizationRole(identity.organizationId, writeRoles);
  if (identity.status === parsed.data.status) return;

  await prisma.$transaction(async (tx) => {
    await tx.identity.update({
      where: { id: identity.id },
      data: { status: parsed.data.status },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: identity.organizationId,
        actorUserId: session.user.id,
        action: "identity.status_changed",
        targetType: "identity",
        targetId: identity.id,
        outcome: "SUCCESS",
        reason: "Identity status updated through the directory.",
        metadata: { previousStatus: identity.status, newStatus: parsed.data.status },
      },
    });
  });

  revalidatePath("/identities");
}
