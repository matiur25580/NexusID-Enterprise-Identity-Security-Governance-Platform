"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export type OnboardingState = { error?: string };

export async function createOrganization(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Enter an organization name between 2 and 80 characters." };

  const name = parsed.data.name;
  const baseSlug = name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "workspace";
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name, slug },
    });

    // Organization creation bootstraps the tenant ID. Establish transaction-local
    // context immediately afterward so tenant-owned writes (including audit) are
    // safe when PostgreSQL RLS is activated.
    await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${organization.id}, true)`;

    await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        role: "OWNER",
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: organization.id,
        actorUserId: session.user.id,
        action: "organization.created",
        targetType: "organization",
        targetId: organization.id,
        outcome: "SUCCESS",
        reason: "Initial workspace created during onboarding.",
      },
    });
  });

  redirect("/");
}
