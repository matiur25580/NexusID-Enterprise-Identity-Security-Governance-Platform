import type { MembershipRole } from "@prisma/client";
export function hasOrganizationRole(role: MembershipRole | null | undefined, allowedRoles: readonly MembershipRole[]): boolean {
  return role != null && allowedRoles.includes(role);
}
