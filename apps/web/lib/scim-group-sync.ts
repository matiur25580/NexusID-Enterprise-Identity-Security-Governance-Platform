import { withTenantContext } from "@/lib/prisma";
import { evaluateAccessPolicy } from "@/lib/policy-engine";
import { Prisma } from "@prisma/client";
export async function syncGroupAccessRequests(groupId:string,connector:{id:string;organizationId:string;createdById:string}){
 const {group,policies}=await withTenantContext(connector.organizationId, async tx=>({
  group:await tx.scimGroup.findFirst({where:{id:groupId,organizationId:connector.organizationId,connectorId:connector.id},include:{members:{where:{identity:{organizationId:connector.organizationId,source:"SCIM:"+connector.id}},include:{identity:true}},mappings:{where:{enabled:true,organizationId:connector.organizationId},include:{entitlement:true}}}}),
  policies:await tx.policyRule.findMany({where:{organizationId:connector.organizationId,enabled:true},orderBy:[{priority:"asc"},{key:"asc"}]})
 }));
 if(!group)return;
 for(const member of group.members){
  for(const mapping of group.mappings){
   const identity=member.identity,entitlement=mapping.entitlement;
   if(identity.organizationId!==connector.organizationId||identity.source!=="SCIM:"+connector.id||entitlement.organizationId!==connector.organizationId)continue;
   const [active,pending]=await withTenantContext(connector.organizationId, tx=>Promise.all([
    tx.accessGrant.findFirst({where:{organizationId:connector.organizationId,identityId:identity.id,entitlementId:entitlement.id,status:"ACTIVE"},select:{id:true}}),
    tx.accessRequest.findFirst({where:{organizationId:connector.organizationId,identityId:identity.id,entitlementId:entitlement.id,status:"PENDING"},select:{id:true}})
   ]));
   if(active||pending)continue;
   const evaluation=evaluateAccessPolicy({identityStatus:identity.status,identityType:identity.type,identityEmail:identity.email,entitlementEnabled:entitlement.enabled,riskLevel:entitlement.riskLevel,privileged:entitlement.privileged,hasActiveGrant:Boolean(active),hasPendingRequest:Boolean(pending)},policies);
   const reason="SCIM_GROUP:"+group.id+":"+entitlement.id+": SCIM group membership mapping: "+group.displayName+" → "+entitlement.name+". A human approver must review this request.";
   await withTenantContext(connector.organizationId, async tx=>{
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

export async function revokeGroupDerivedAccess(
  tx: Prisma.TransactionClient,
  group: { id: string; displayName: string; mappings: { entitlementId: string }[] },
  connector: { id: string; organizationId: string; createdById: string },
  identityIds: string[],
) {
  let revokedGrants = 0;
  let cancelledRequests = 0;
  for (const identityId of identityIds) {
    for (const mapping of group.mappings) {
      const marker = "SCIM_GROUP:" + group.id + ":" + mapping.entitlementId + ":";
      const requests = await tx.accessRequest.findMany({
        where: { organizationId: connector.organizationId, identityId, entitlementId: mapping.entitlementId, requestReason: { startsWith: marker } },
        select: { id: true },
      });
      if (!requests.length) continue;
      const requestIds = requests.map((request) => request.id);
      const [revoked, cancelled] = await Promise.all([
        tx.accessGrant.updateMany({
          where: { organizationId: connector.organizationId, requestId: { in: requestIds }, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: new Date() },
        }),
        tx.accessRequest.updateMany({
          where: { organizationId: connector.organizationId, id: { in: requestIds }, status: "PENDING" },
          data: { status: "CANCELLED" },
        }),
      ]);
      revokedGrants += revoked.count;
      cancelledRequests += cancelled.count;
    }
  }
  if (revokedGrants || cancelledRequests) {
    await tx.auditEvent.create({
      data: {
        organizationId: connector.organizationId,
        actorUserId: connector.createdById,
        action: "scim.group.access_revoked",
        targetType: "scim_group",
        targetId: group.id,
        outcome: "SUCCESS",
        reason: "SCIM group membership removal revoked grants and cancelled pending requests created by this group mapping.",
        metadata: { connectorId: connector.id, identityCount: identityIds.length, grantsRevoked: revokedGrants, requestsCancelled: cancelledRequests },
      },
    });
  }
}
