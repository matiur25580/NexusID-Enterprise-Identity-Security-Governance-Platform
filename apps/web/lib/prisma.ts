import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Execute tenant-owned database work with a transaction-local PostgreSQL RLS
 * context. The organization must come from a server-validated membership,
 * never directly from untrusted form or request input.
 */
export async function withTenantContext<T>(
  organizationId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!organizationId || !organizationId.trim()) {
    throw new Error("A validated organization context is required.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
    return work(tx);
  });
}
