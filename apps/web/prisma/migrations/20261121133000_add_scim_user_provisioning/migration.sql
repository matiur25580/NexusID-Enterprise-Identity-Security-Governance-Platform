ALTER TABLE "Identity" ADD COLUMN "userName" TEXT;
CREATE UNIQUE INDEX "Identity_organizationId_userName_key" ON "Identity"("organizationId","userName");
CREATE TABLE "ScimConnector" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 "lastUsedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ScimConnector_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScimConnector_tokenHash_key" ON "ScimConnector"("tokenHash");
CREATE INDEX "ScimConnector_organizationId_enabled_createdAt_idx" ON "ScimConnector"("organizationId","enabled","createdAt");
ALTER TABLE "ScimConnector" ADD CONSTRAINT "ScimConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimConnector" ADD CONSTRAINT "ScimConnector_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
