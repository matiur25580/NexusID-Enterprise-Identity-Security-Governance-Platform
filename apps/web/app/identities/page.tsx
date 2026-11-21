import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import IdentityDirectory from "@/components/identity-directory";

export default async function IdentitiesPage() {
  const context = await getTenantContext();
  const identities = await prisma.identity.findMany({
    where: { organizationId: context.organization.id },
    orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }],
    take: 250,
    select: {
      id: true,
      displayName: true,
      email: true,
      type: true,
      status: true,
      source: true,
      externalId: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <IdentityDirectory
      organizationName={context.organization.name}
      role={context.membership.role}
      initialIdentities={identities.map((identity) => ({
        ...identity,
        lastSeenAt: identity.lastSeenAt?.toISOString() ?? null,
        createdAt: identity.createdAt.toISOString(),
        updatedAt: identity.updatedAt.toISOString(),
      }))}
    />
  );
}
