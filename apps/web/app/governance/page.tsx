import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import GovernanceConsole from "@/components/governance-console";

export default async function GovernancePage() {
  const context = await getTenantContext();
  const organizationId = context.organization.id;
  const [applications, identities, requests, grants] = await Promise.all([
    prisma.application.findMany({
      where: { organizationId },
      include: { entitlements: { where: { enabled: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.identity.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, displayName: true, email: true, type: true },
      orderBy: { displayName: "asc" },
      take: 500,
    }),
    prisma.accessRequest.findMany({
      where: { organizationId },
      include: {
        identity: { select: { displayName: true, email: true } },
        entitlement: { include: { application: { select: { name: true } } } },
        requester: { select: { name: true, email: true } },
        decisionUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.accessGrant.findMany({
      where: { organizationId },
      include: {
        identity: { select: { displayName: true, email: true } },
        entitlement: { include: { application: { select: { name: true } } } },
      },
      orderBy: { grantedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <GovernanceConsole
      organizationName={context.organization.name}
      role={context.membership.role}
      applications={applications.map((app) => ({
        id: app.id, name: app.name, slug: app.slug, description: app.description, ownerTeam: app.ownerTeam,
        entitlements: app.entitlements.map((item) => ({
          id: item.id, key: item.key, name: item.name, description: item.description,
          riskLevel: item.riskLevel, privileged: item.privileged,
        })),
      }))}
      identities={identities}
      requests={requests.map((item) => ({
        id: item.id, status: item.status, requestReason: item.requestReason, decisionReason: item.decisionReason,
        createdAt: item.createdAt.toISOString(), decidedAt: item.decidedAt?.toISOString() ?? null,
        identityName: item.identity.displayName, identityEmail: item.identity.email,
        entitlementName: item.entitlement.name, entitlementKey: item.entitlement.key,
        applicationName: item.entitlement.application.name,
        requesterName: item.requester.name ?? item.requester.email ?? "Workspace user",
        decisionName: item.decisionUser?.name ?? item.decisionUser?.email ?? null,
        requesterUserId: item.requesterUserId,
      }))}
      grants={grants.map((item) => ({
        id: item.id, status: item.status, grantedAt: item.grantedAt.toISOString(),
        revokedAt: item.revokedAt?.toISOString() ?? null,
        identityName: item.identity.displayName, identityEmail: item.identity.email,
        entitlementName: item.entitlement.name, entitlementKey: item.entitlement.key,
        applicationName: item.entitlement.application.name,
      }))}
      currentUserId={context.userId}
    />
  );
}
