import { MembershipRole } from "@prisma/client";
import { hasOrganizationRole } from "@/lib/role-policy";
export { hasOrganizationRole } from "@/lib/role-policy";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// Resolve the signed-in user's live membership before accepting an organization-scoped role.
export async function requireOrganizationRole(
  organizationId: string,
  allowedRoles: MembershipRole[],
) {
  const session = await auth();
  if (!session?.user?.id) throw new AuthorizationError("Authentication required.");

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { id: true, organizationId: true, userId: true, role: true },
  });

  if (!membership || !hasOrganizationRole(membership.role, allowedRoles)) {
    throw new AuthorizationError();
  }

  return membership;
}

export async function requireCurrentOrganizationRole(allowedRoles: MembershipRole[]) {
  const session = await auth();
  if (!session?.user?.id) throw new AuthorizationError("Authentication required.");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, userId: true, role: true },
  });

  if (!membership || !hasOrganizationRole(membership.role, allowedRoles)) {
    throw new AuthorizationError();
  }

  return membership;
}
