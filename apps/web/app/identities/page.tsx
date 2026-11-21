import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { hasOrganizationRole } from "@/lib/authorization";
import { calculateIdentityRisk } from "@/lib/identity-risk";
import IdentityDirectory from "@/components/identity-directory";
export default async function IdentitiesPage() {
  const context = await getTenantContext();
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);
  windowStart.setUTCHours(0, 0, 0, 0);
  const [identities, snapshots] = await Promise.all([
    prisma.identity.findMany({
      where: { organizationId: context.organization.id },
      orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }], take: 250,
      select: {
        id: true, displayName: true, email: true, type: true, status: true, source: true,
        externalId: true, lastSeenAt: true, createdAt: true, updatedAt: true,
        accessGrants: { where: { organizationId: context.organization.id, status: "ACTIVE" }, select: { entitlement: { select: { riskLevel: true, privileged: true } } } },
      },
    }),
    prisma.identityRiskSnapshot.findMany({
      where: { organizationId: context.organization.id, capturedOn: { gte: windowStart } },
      orderBy: { capturedOn: "asc" },
      select: { id: true, identityId: true, score: true, level: true, capturedOn: true },
    }),
  ]);
  const asOf = new Date();
  const daily = new Map<string, { date: string; count: number; averageScore: number; elevated: number; total: number }>();
  for (const snapshot of snapshots) {
    const date = snapshot.capturedOn.toISOString().slice(0, 10);
    const entry = daily.get(date) ?? { date, count: 0, averageScore: 0, elevated: 0, total: 0 };
    entry.count += 1; entry.total += snapshot.score;
    if (snapshot.score >= 50) entry.elevated += 1;
    entry.averageScore = Math.round(entry.total / entry.count);
    daily.set(date, entry);
  }
  return <IdentityDirectory
    organizationName={context.organization.name}
    role={context.membership.role}
    canCaptureRiskSnapshot={hasOrganizationRole(context.membership.role, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.SECURITY_ANALYST])}
    riskHistory={[...daily.values()]}
    initialIdentities={identities.map((identity) => ({
      ...identity,
      risk: calculateIdentityRisk({ status: identity.status, type: identity.type, lastSeenAt: identity.lastSeenAt, activeGrants: identity.accessGrants.map((grant) => grant.entitlement) }, asOf),
      lastSeenAt: identity.lastSeenAt?.toISOString() ?? null,
      createdAt: identity.createdAt.toISOString(), updatedAt: identity.updatedAt.toISOString(),
    }))}
  />;
}
