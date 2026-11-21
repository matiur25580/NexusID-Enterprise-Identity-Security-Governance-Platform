import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const enabled = process.env.NEXUSID_INTEGRATION_TEST === "1";
test("database-backed tenant isolation and membership authorization", { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Refusing to run integration fixtures in production.");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required.");
  const databaseName = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "").split("?")[0];
  assert.equal(databaseName, "nexusid", "Integration tests only run against the dedicated nexusid test database.");
  const source = await readFile(new URL("../lib/role-policy.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { hasOrganizationRole } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const createdOrgIds = [];
  const createdUserIds = [];
  try {
    const orgA = await prisma.organization.create({ data: { name: "Tenant A " + suffix, slug: "tenant-a-" + suffix } });
    createdOrgIds.push(orgA.id);
    const orgB = await prisma.organization.create({ data: { name: "Tenant B " + suffix, slug: "tenant-b-" + suffix } });
    createdOrgIds.push(orgB.id);
    const userA = await prisma.user.create({ data: { email: "tenant-a-" + suffix + "@example.test" } });
    createdUserIds.push(userA.id);
    const userB = await prisma.user.create({ data: { email: "tenant-b-" + suffix + "@example.test" } });
    createdUserIds.push(userB.id);
    await prisma.membership.create({ data: { organizationId: orgA.id, userId: userA.id, role: "SECURITY_ANALYST" } });
    await prisma.membership.create({ data: { organizationId: orgB.id, userId: userB.id, role: "MEMBER" } });
    const identityA = await prisma.identity.create({ data: { organizationId: orgA.id, displayName: "Tenant A identity", type: "HUMAN", status: "ACTIVE" } });
    const identityB = await prisma.identity.create({ data: { organizationId: orgB.id, displayName: "Tenant B identity", type: "HUMAN", status: "ACTIVE" } });
    const applicationA = await prisma.application.create({ data: { organizationId: orgA.id, name: "Tenant A app", slug: "tenant-a-" + suffix } });
    const applicationB = await prisma.application.create({ data: { organizationId: orgB.id, name: "Tenant B app", slug: "tenant-b-" + suffix } });
    const entitlementA = await prisma.entitlement.create({
      data: { organizationId: orgA.id, applicationId: applicationA.id, key: "reader", name: "Tenant A reader" },
    });
    const entitlementB = await prisma.entitlement.create({
      data: { organizationId: orgB.id, applicationId: applicationB.id, key: "reader", name: "Tenant B reader" },
    });
    await prisma.auditEvent.create({ data: { organizationId: orgA.id, action: "tenant-a.rls-fixture", targetType: "integration", outcome: "SUCCESS" } });
    await prisma.auditEvent.create({ data: { organizationId: orgB.id, action: "tenant-b.rls-fixture", targetType: "integration", outcome: "SUCCESS" } });

    await assert.rejects(
      prisma.entitlement.create({
        data: { organizationId: orgB.id, applicationId: applicationA.id, key: "cross-tenant", name: "Invalid cross-tenant entitlement" },
      }),
      (error) => error?.code === "P2003",
      "PostgreSQL must reject an entitlement whose application belongs to another organization.",
    );
    await assert.rejects(
      prisma.accessRequest.create({
        data: {
          organizationId: orgB.id,
          identityId: identityA.id,
          entitlementId: entitlementB.id,
          requesterUserId: userB.id,
          requestReason: "Cross-tenant integrity regression test",
        },
      }),
      (error) => error?.code === "P2003",
      "PostgreSQL must reject an access request whose identity belongs to another organization.",
    );
    assert.ok(entitlementA.id);

    // Prove RLS with a real non-owner, non-superuser, non-BYPASSRLS role.
    // All role/table changes are rolled back so CI's schema remains unchanged.
    const rlsRole = "nexusid_rls_" + suffix.replace(/-/g, "");
    const rollbackRls = new Error("ROLLBACK_RLS_POLICY_TEST");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE ROLE "${rlsRole}" NOLOGIN NOSUPERUSER NOBYPASSRLS`);
        for (const table of ["Identity", "Application", "Entitlement", "AuditEvent"]) {
          await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
          await tx.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
          await tx.$executeRawUnsafe(`GRANT SELECT ON "${table}" TO "${rlsRole}"`);
        }
        await tx.$executeRawUnsafe(`GRANT INSERT ON "AuditEvent" TO "${rlsRole}"`);
        await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public, app TO "${rlsRole}"`);
        await tx.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION app.current_organization_id() TO "${rlsRole}"`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${rlsRole}"`);
        await tx.$queryRaw`SELECT set_config('app.current_organization_id', '', true)`;
        assert.equal(await tx.identity.count(), 0, "RLS must fail closed without tenant context.");
        await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${orgA.id}, true)`;
        assert.deepEqual((await tx.identity.findMany({ orderBy: { id: "asc" } })).map((item) => item.id), [identityA.id]);
        assert.deepEqual((await tx.application.findMany()).map((item) => item.id), [applicationA.id]);
        assert.deepEqual((await tx.entitlement.findMany()).map((item) => item.id), [entitlementA.id]);
        assert.deepEqual((await tx.auditEvent.findMany({ select: { organizationId: true } })).map((item) => item.organizationId), [orgA.id]);
        await tx.auditEvent.create({ data: { organizationId: orgA.id, action: "tenant-a.rls-insert", targetType: "integration", outcome: "SUCCESS" } });
        // A PostgreSQL statement error aborts the current transaction. Isolate
        // the expected RLS rejection behind a savepoint so the rest of this
        // interactive transaction can continue and verify tenant B's view.
        await tx.$executeRawUnsafe("SAVEPOINT before_cross_tenant_audit_insert");
        let crossTenantInsertRejected = false;
        try {
          await tx.auditEvent.create({ data: { organizationId: orgB.id, action: "tenant-b.rls-insert-denied", targetType: "integration", outcome: "SUCCESS" } });
        } catch {
          crossTenantInsertRejected = true;
        } finally {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT before_cross_tenant_audit_insert");
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT before_cross_tenant_audit_insert");
        }
        assert.equal(crossTenantInsertRejected, true, "RLS must reject an audit write for another tenant.");
        assert.equal(await tx.auditEvent.count(), 2, "Tenant A can read only its own audit events.");
        await tx.$queryRaw`SELECT set_config('app.current_organization_id', ${orgB.id}, true)`;
        assert.deepEqual((await tx.identity.findMany()).map((item) => item.id), [identityB.id]);
        assert.deepEqual((await tx.application.findMany()).map((item) => item.id), [applicationB.id]);
        assert.equal(await tx.auditEvent.count(), 1, "Tenant B can read only its own audit events.");
        throw rollbackRls;
      });
    } catch (error) {
      if (error !== rollbackRls) throw error;
    }

    const visibleToA = await prisma.identity.findMany({ where: { organizationId: orgA.id } });
    assert.deepEqual(visibleToA.map((item) => item.id), [identityA.id]);
    assert.equal(await prisma.identity.findFirst({ where: { id: identityB.id, organizationId: orgA.id } }), null);

    const memberA = await prisma.membership.findUnique({ where: { organizationId_userId: { organizationId: orgA.id, userId: userA.id } } });
    const memberB = await prisma.membership.findUnique({ where: { organizationId_userId: { organizationId: orgB.id, userId: userB.id } } });
    assert.ok(memberA);
    assert.ok(memberB);
    assert.equal(hasOrganizationRole(memberA.role, ["OWNER", "ADMIN", "SECURITY_ANALYST"]), true);
    assert.equal(hasOrganizationRole(memberB.role, ["OWNER", "ADMIN", "SECURITY_ANALYST"]), false);
    assert.equal(hasOrganizationRole(null, ["OWNER"]), false);

    await prisma.auditEvent.create({ data: { organizationId: orgA.id, actorUserId: userA.id, action: "integration.test", targetType: "identity", targetId: identityA.id, outcome: "SUCCESS" } });
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: orgA.id } }), 1);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: orgB.id } }), 0);
  } finally {
    if (createdOrgIds.length) await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});
