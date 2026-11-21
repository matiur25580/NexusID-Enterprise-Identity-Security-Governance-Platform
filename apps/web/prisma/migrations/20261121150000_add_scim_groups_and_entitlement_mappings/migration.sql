CREATE TABLE "ScimGroup" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "connectorId" TEXT NOT NULL,
 "externalId" TEXT NOT NULL,
 "displayName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ScimGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScimGroupMember" (
 "id" TEXT NOT NULL,
 "groupId" TEXT NOT NULL,
 "identityId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ScimGroupMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScimGroupEntitlementMapping" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "groupId" TEXT NOT NULL,
 "entitlementId" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ScimGroupEntitlementMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScimGroup_connectorId_externalId_key" ON "ScimGroup"("connectorId","externalId");
CREATE INDEX "ScimGroup_organizationId_displayName_idx" ON "ScimGroup"("organizationId","displayName");
CREATE UNIQUE INDEX "ScimGroupMember_groupId_identityId_key" ON "ScimGroupMember"("groupId","identityId");
CREATE INDEX "ScimGroupMember_identityId_idx" ON "ScimGroupMember"("identityId");
CREATE UNIQUE INDEX "ScimGroupEntitlementMapping_groupId_entitlementId_key" ON "ScimGroupEntitlementMapping"("groupId","entitlementId");
CREATE INDEX "ScimGroupEntitlementMapping_organizationId_enabled_idx" ON "ScimGroupEntitlementMapping"("organizationId","enabled");
ALTER TABLE "ScimGroup" ADD CONSTRAINT "ScimGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroup" ADD CONSTRAINT "ScimGroup_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "ScimConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupMember" ADD CONSTRAINT "ScimGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ScimGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupMember" ADD CONSTRAINT "ScimGroupMember_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupEntitlementMapping" ADD CONSTRAINT "ScimGroupEntitlementMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupEntitlementMapping" ADD CONSTRAINT "ScimGroupEntitlementMapping_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ScimGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupEntitlementMapping" ADD CONSTRAINT "ScimGroupEntitlementMapping_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
