import { getTenantContext } from "@/lib/tenant";
import { withTenantContext } from "@/lib/prisma";
import { hasOrganizationRole } from "@/lib/authorization";
import { MembershipRole } from "@prisma/client";
import { ScimConsole } from "@/components/scim-console";
export default async function ScimPage(){
 const context=await getTenantContext(),organizationId=context.organization.id;
 const [connectors,groups,entitlements]=await withTenantContext(organizationId, (tx) => Promise.all([
  tx.scimConnector.findMany({where:{organizationId},orderBy:{createdAt:"desc"},take:100,select:{id:true,name:true,enabled:true,createdAt:true,lastUsedAt:true}}),
  tx.scimGroup.findMany({where:{organizationId},orderBy:{displayName:"asc"},take:200,include:{_count:{select:{members:true}},mappings:{include:{entitlement:{select:{id:true,name:true,application:{select:{name:true}}}}}}}}),
  tx.entitlement.findMany({where:{organizationId,enabled:true},orderBy:{name:"asc"},take:200,select:{id:true,name:true,application:{select:{name:true}}}})
 ]));
 return <ScimConsole canManage={hasOrganizationRole(context.membership.role,[MembershipRole.OWNER,MembershipRole.ADMIN])} connectors={connectors.map(c=>({...c,createdAt:c.createdAt.toISOString(),lastUsedAt:c.lastUsedAt?.toISOString()??null}))} groups={groups.map(g=>({id:g.id,displayName:g.displayName,connectorId:g.connectorId,memberCount:g._count.members,mappings:g.mappings.map(m=>({id:m.id,entitlementId:m.entitlementId,entitlementName:m.entitlement.name,applicationName:m.entitlement.application.name}))}))} entitlements={entitlements.map(e=>({id:e.id,name:e.name,applicationName:e.application.name}))}/>;
}
