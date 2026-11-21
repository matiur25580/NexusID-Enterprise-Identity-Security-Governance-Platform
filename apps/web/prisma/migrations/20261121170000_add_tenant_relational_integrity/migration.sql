-- Enforce tenant-consistent relationships at the PostgreSQL boundary.
-- Existing single-column foreign keys remain in place; these composite keys
-- prevent a row from referencing a parent owned by a different organization.
-- This migration intentionally fails if pre-existing cross-tenant references
-- are found. Repair those rows explicitly before retrying.

CREATE UNIQUE INDEX IF NOT EXISTS "Identity_id_organizationId_key"
  ON "Identity" ("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Application_id_organizationId_key"
  ON "Application" ("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_id_organizationId_key"
  ON "Entitlement" ("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_id_organizationId_key"
  ON "AccessRequest" ("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScimConnector_id_organizationId_key"
  ON "ScimConnector" ("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScimGroup_id_organizationId_key"
  ON "ScimGroup" ("id", "organizationId");

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_applicationId_organizationId_fkey"
  FOREIGN KEY ("applicationId", "organizationId")
  REFERENCES "Application" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_identityId_organizationId_fkey"
  FOREIGN KEY ("identityId", "organizationId")
  REFERENCES "Identity" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AccessRequest_entitlementId_organizationId_fkey"
  FOREIGN KEY ("entitlementId", "organizationId")
  REFERENCES "Entitlement" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessGrant"
  ADD CONSTRAINT "AccessGrant_identityId_organizationId_fkey"
  FOREIGN KEY ("identityId", "organizationId")
  REFERENCES "Identity" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AccessGrant_entitlementId_organizationId_fkey"
  FOREIGN KEY ("entitlementId", "organizationId")
  REFERENCES "Entitlement" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityRiskSnapshot"
  ADD CONSTRAINT "IdentityRiskSnapshot_identityId_organizationId_fkey"
  FOREIGN KEY ("identityId", "organizationId")
  REFERENCES "Identity" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityRiskAlert"
  ADD CONSTRAINT "IdentityRiskAlert_identityId_organizationId_fkey"
  FOREIGN KEY ("identityId", "organizationId")
  REFERENCES "Identity" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifecycleRequest"
  ADD CONSTRAINT "LifecycleRequest_identityId_organizationId_fkey"
  FOREIGN KEY ("identityId", "organizationId")
  REFERENCES "Identity" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScimGroup"
  ADD CONSTRAINT "ScimGroup_connectorId_organizationId_fkey"
  FOREIGN KEY ("connectorId", "organizationId")
  REFERENCES "ScimConnector" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScimGroupEntitlementMapping"
  ADD CONSTRAINT "ScimGroupEntitlementMapping_groupId_organizationId_fkey"
  FOREIGN KEY ("groupId", "organizationId")
  REFERENCES "ScimGroup" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScimGroupEntitlementMapping_entitlementId_organizationId_fkey"
  FOREIGN KEY ("entitlementId", "organizationId")
  REFERENCES "Entitlement" ("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
