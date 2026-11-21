import { prisma } from "@/lib/prisma";
import { evaluateAccessPolicy } from "@/lib/policy-engine";
export async function syncGroupAccessRequests(groupId:string,connector:{id:string;organizationId:string;createdById:string}){
 const group=await prisma.scimGroup.findFirst({where:{id:groupId,organizationId:connector.organizationId,connectorId:connector.id},include:{members:{include:{identity:true}},mappings:{where:{enabled:true},include:{entitlement:true}}}});
 if(!group)return;
 const policies=await prisma.policyRule.findMany({where:{organizationId:connector.organizationId,enabled:true},orderBy:[{priority:"asc"},{key:"asc"}]});
 for(const member of group.members){
  for(const mapping of group.mappings){
   const identity=member.identity,entitlement=mapping.entitlement;
   const [active,pending]=await Promise.all([
    prisma.accessGrant.findFirst({where:{organizationId:connector.organizationId,identityId:identity.id,entitlementId:entitlement.id,status:"ACTIVE"},select:{id:true}}),
    prisma.accessRequest.findFirst({where:{organizationId:connector.organizationId,identityId:identity.id,entitlementId:entitlement.id,status:"PENDING"},select:{id:true}})
   ]);
   if(active||pending)continue;
   const evaluation=evaluateAccessPolicy({identityStatus:identity.status,identityType:identity.type,identityEmail:identity.email,entitlementEnabled:entitlement.enabled,riskLevel:entitlement.riskLevel,privileged:entitlement.privileged,hasActiveGrant:Boolean(active),hasPendingRequest:Boolean(pending)},policies);
   const reason="SCIM group membership mapping: "+group.displayName+" → "+entitlement.name+". A human approver must review this request.";
   await prisma.$transaction(async tx=>{
    if(evaluation.outcome==="DENY"){
     await tx.auditEvent.create({data:{organizationId:connector.organizationId,actorUserId:connector.createdById,action:"scim.group.access_request.denied",targetType:"identity",targetId:identity.id,outcome:"DENIED",reason:evaluation.summary,metadata:{connectorId:connector.id,groupId:group.id,entitlementId:entitlement.id,policyRules:evaluation.rules.map(r=>r.code)}}});
     return;
    }
    const created=await tx.accessRequest.create({data:{organizationId:connector.organizationId,identityId:identity.id,entitlementId:entitlement.id,requesterUserId:connector.createdById,requestReason:reason}});
    await tx.auditEvent.create({data:{organizationId:connector.organizationId,actorUserId:connector.createdById,action:"scim.group.access_request.created",targetType:"access_request",targetId:created.id,outcome:"SUCCESS",reason,metadata:{connectorId:connector.id,groupId:group.id,entitlementId:entitlement.id,policyOutcome:evaluation.outcome,policyRules:evaluation.rules.map(r=>r.code)}}});
   });
  }
 }
}
