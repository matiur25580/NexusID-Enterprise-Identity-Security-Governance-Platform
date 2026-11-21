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
