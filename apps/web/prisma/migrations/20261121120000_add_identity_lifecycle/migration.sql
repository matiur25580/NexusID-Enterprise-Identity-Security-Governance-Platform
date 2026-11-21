CREATE TYPE "LifecycleEventType" AS ENUM ('JOINER','MOVER','LEAVER');
CREATE TYPE "LifecycleRequestStatus" AS ENUM ('PENDING','COMPLETED','REJECTED');
CREATE TABLE "LifecycleRequest" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "identityId" TEXT NOT NULL,
 "requesterUserId" TEXT NOT NULL,
 "decisionUserId" TEXT,
 "type" "LifecycleEventType" NOT NULL,
 "status" "LifecycleRequestStatus" NOT NULL DEFAULT 'PENDING',
 "reason" TEXT NOT NULL,
 "grantIds" JSONB,
 "decidedAt" TIMESTAMP(3),
 "completedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LifecycleRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LifecycleRequest_organizationId_status_createdAt_idx" ON "LifecycleRequest"("organizationId","status","createdAt");
CREATE INDEX "LifecycleRequest_identityId_status_idx" ON "LifecycleRequest"("identityId","status");
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_decisionUserId_fkey" FOREIGN KEY ("decisionUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
