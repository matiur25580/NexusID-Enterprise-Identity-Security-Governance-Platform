import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import PolicyStudio from "@/components/policy-studio";

export default async function PoliciesPage() {
  const context = await getTenantContext();
  const [identities, entitlements] = await Promise.all([
    prisma.identity.findMany({
      where: { organizationId: context.organization.id },
      select: { id: true, displayName: true, email: true, type: true, status: true },
      orderBy: { displayName: "asc" },
      take: 500,
    }),
    prisma.entitlement.findMany({
      where: { organizationId: context.organization.id },
      include: { application: { select: { name: true } } },
      orderBy: [{ riskLevel: "desc" }, { name: "asc" }],
      take: 500,
    }),
  ]);
  return <PolicyStudio
    organizationName={context.organization.name}
    identities={identities}
    entitlements={entitlements.map((item) => ({
      id: item.id,
      name: item.name,
      key: item.key,
      riskLevel: item.riskLevel,
      privileged: item.privileged,
      enabled: item.enabled,
      applicationName: item.application.name,
    }))}
  />;
}
