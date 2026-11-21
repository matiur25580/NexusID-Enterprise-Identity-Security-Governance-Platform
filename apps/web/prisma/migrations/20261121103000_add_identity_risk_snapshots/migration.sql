CREATE TABLE "IdentityRiskSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "level" TEXT NOT NULL,
  "factors" JSONB NOT NULL,
  "methodology" TEXT NOT NULL,
  "capturedOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityRiskSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityRiskSnapshot_organizationId_identityId_capturedOn_key"
  ON "IdentityRiskSnapshot"("organizationId", "identityId", "capturedOn");
CREATE INDEX "IdentityRiskSnapshot_organizationId_capturedOn_idx"
  ON "IdentityRiskSnapshot"("organizationId", "capturedOn");
CREATE INDEX "IdentityRiskSnapshot_identityId_capturedOn_idx"
  ON "IdentityRiskSnapshot"("identityId", "capturedOn");

ALTER TABLE "IdentityRiskSnapshot"
  ADD CONSTRAINT "IdentityRiskSnapshot_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityRiskSnapshot"
  ADD CONSTRAINT "IdentityRiskSnapshot_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
