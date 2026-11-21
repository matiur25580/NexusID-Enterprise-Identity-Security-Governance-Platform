import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import PolicyStudio from "@/components/policy-studio";

export default async function PoliciesPage() {
  const context = await getTenantContext();
  const [identities, entitlements, policies] = await Promise.all([
    prisma.identity.findMany({
      where: { organizationId: context.organization.id },
      select: { id: true, displayName: true, email: true, type: true, status: true },
      orderBy: { displayName: "asc" }, take: 500,
    }),
    prisma.entitlement.findMany({
      where: { organizationId: context.organization.id },
      include: { application: { select: { name: true } } },
      orderBy: [{ riskLevel: "desc" }, { name: "asc" }], take: 500,
    }),
    prisma.policyRule.findMany({
      where: { organizationId: context.organization.id },
      include: { versions: { orderBy: { version: "desc" }, take: 5, include: { changedBy: { select: { name: true, email: true } } } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  return <PolicyStudio
    organizationName={context.organization.name}
    canManage={["OWNER", "ADMIN", "SECURITY_ANALYST"].includes(context.membership.role)}
    identities={identities}
    entitlements={entitlements.map((item) => ({
      id: item.id, name: item.name, key: item.key, riskLevel: item.riskLevel,
      privileged: item.privileged, enabled: item.enabled, applicationName: item.application.name,
    }))}
    policies={policies.map((rule) => ({
      id: rule.id, key: rule.key, name: rule.name, description: rule.description,
      effect: rule.effect, field: rule.field, operator: rule.operator, value: rule.value,
      priority: rule.priority, enabled: rule.enabled, version: rule.version,
      lastSimulatedAt: rule.lastSimulatedAt?.toISOString() ?? null,
      validatedVersion: rule.validatedVersion,
      updatedAt: rule.updatedAt.toISOString(),
      versions: rule.versions.map((version) => ({
        version: version.version, changeNote: version.changeNote,
        createdAt: version.createdAt.toISOString(),
        actor: version.changedBy.name ?? version.changedBy.email,
      })),
    }))}
  />;
}
