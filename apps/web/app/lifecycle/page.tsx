import { getTenantContext } from "@/lib/tenant";
import { withTenantContext } from "@/lib/prisma";
import { LifecycleConsole } from "@/components/lifecycle-console";
import { hasOrganizationRole } from "@/lib/authorization";
import { MembershipRole } from "@prisma/client";
export default async function LifecyclePage(){
 const context=await getTenantContext();
 const [identities,requests]=await withTenantContext(context.organization.id, (tx) => Promise.all([
  tx.identity.findMany({where:{organizationId:context.organization.id},orderBy:{displayName:"asc"},select:{id:true,displayName:true,email:true,status:true,type:true,accessGrants:{where:{organizationId:context.organization.id,status:"ACTIVE"},select:{id:true,entitlement:{select:{name:true,key:true,application:{select:{name:true}}}}}}}}),
  tx.lifecycleRequest.findMany({where:{organizationId:context.organization.id},include:{identity:{select:{displayName:true,email:true,status:true}},requester:{select:{name:true,email:true}},decisionUser:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:100})
 ]));
 return <LifecycleConsole organizationName={context.organization.name} role={context.membership.role} canApprove={hasOrganizationRole(context.membership.role,[MembershipRole.OWNER,MembershipRole.ADMIN,MembershipRole.SECURITY_ANALYST])} identities={identities.map(i=>({id:i.id,name:i.displayName,email:i.email,status:i.status,type:i.type,grants:i.accessGrants.map(g=>({id:g.id,name:g.entitlement.name,key:g.entitlement.key,application:g.entitlement.application.name}))}))} requests={requests.map(r=>({id:r.id,type:r.type,status:r.status,reason:r.reason,grantIds:Array.isArray(r.grantIds)?r.grantIds.filter((x):x is string=>typeof x==="string"):[],createdAt:r.createdAt.toISOString(),decidedAt:r.decidedAt?.toISOString()??null,identityName:r.identity.displayName,identityEmail:r.identity.email,identityStatus:r.identity.status,requester:r.requester.name??r.requester.email??"Workspace user",decider:r.decisionUser?.name??r.decisionUser?.email??null}))}/>;
}
