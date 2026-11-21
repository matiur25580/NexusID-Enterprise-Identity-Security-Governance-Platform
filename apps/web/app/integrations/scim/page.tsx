import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { hasOrganizationRole } from "@/lib/authorization";
import { MembershipRole } from "@prisma/client";
import { ScimConsole } from "@/components/scim-console";
export default async function ScimPage(){
 const context=await getTenantContext();
 const connectors=await prisma.scimConnector.findMany({where:{organizationId:context.organization.id},orderBy:{createdAt:"desc"},take:100,select:{id:true,name:true,enabled:true,createdAt:true,lastUsedAt:true}});
 return <ScimConsole canManage={hasOrganizationRole(context.membership.role,[MembershipRole.OWNER,MembershipRole.ADMIN])} connectors={connectors.map(c=>({...c,createdAt:c.createdAt.toISOString(),lastUsedAt:c.lastUsedAt?.toISOString()??null}))}/>;
}
