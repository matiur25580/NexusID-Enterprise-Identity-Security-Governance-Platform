import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import CertificationConsole from "@/components/certification-console";

export default async function CertificationsPage() {
  const context = await getTenantContext();
  const campaigns = await prisma.certificationCampaign.findMany({
    where: { organizationId: context.organization.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      items: {
        include: {
          reviewer: { select: { name: true, email: true } },
          grant: {
            include: {
              identity: { select: { displayName: true, email: true, type: true } },
              entitlement: { include: { application: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <CertificationConsole
    organizationName={context.organization.name}
    role={context.membership.role}
    campaigns={campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      dueAt: campaign.dueAt.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
      completedAt: campaign.completedAt?.toISOString() ?? null,
      createdBy: campaign.createdBy.name ?? campaign.createdBy.email ?? "Workspace user",
      items: campaign.items.map((item) => ({
        id: item.id,
        status: item.status,
        decisionReason: item.decisionReason,
        decidedAt: item.decidedAt?.toISOString() ?? null,
        reviewer: item.reviewer?.name ?? item.reviewer?.email ?? null,
        grantStatus: item.grant.status,
        grantedAt: item.grant.grantedAt.toISOString(),
        identityName: item.grant.identity.displayName,
        identityEmail: item.grant.identity.email,
        identityType: item.grant.identity.type,
        entitlementName: item.grant.entitlement.name,
        entitlementKey: item.grant.entitlement.key,
        applicationName: item.grant.entitlement.application.name,
      })),
    }))}
  />;
}
