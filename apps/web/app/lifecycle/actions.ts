"use server";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

const approverRoles: MembershipRole[] = ["OWNER","ADMIN","SECURITY_ANALYST"];
const requesterRoles: MembershipRole[] = [...approverRoles,"MEMBER"];
async function actorContext(){
 const session=await auth();if(!session?.user?.id)throw new Error("Authentication required.");
 const membership=await prisma.membership.findFirst({where:{userId:session.user.id},orderBy:{createdAt:"asc"},select:{organizationId:true}});
 if(!membership)throw new Error("No organization workspace found.");
 return {userId:session.user.id,organizationId:membership.organizationId};
}
const createSchema=z.object({
 identityId:z.string().min(1),
 type:z.enum(["JOINER","MOVER","LEAVER"]),
 reason:z.string().trim().min(10).max(1200),
 grantIds:z.array(z.string().min(1)).max(50).default([]),
});
export async function createLifecycleRequest(formData:FormData):Promise<void>{
 const actor=await actorContext();await requireOrganizationRole(actor.organizationId,requesterRoles);
 const rawGrantIds=String(formData.get("grantIds")??"").split(",").map(x=>x.trim()).filter(Boolean);
 const parsed=createSchema.safeParse({identityId:formData.get("identityId"),type:formData.get("type"),reason:formData.get("reason"),grantIds:rawGrantIds});
 if(!parsed.success)throw new Error("Provide an identity, lifecycle event, a clear reason, and valid grant IDs.");
 const identity=await prisma.identity.findFirst({where:{id:parsed.data.identityId,organizationId:actor.organizationId},select:{id:true,status:true}});
 if(!identity)throw new Error("Identity not found in the active workspace.");
 if(parsed.data.type==="JOINER"&&identity.status!=="PENDING")throw new Error("Joiner approval is only available for a pending identity.");
 if(parsed.data.type==="LEAVER"&&identity.status==="DISABLED")throw new Error("This identity is already disabled.");
 if(parsed.data.type==="MOVER"&&parsed.data.grantIds.length===0)throw new Error("Select at least one grant ID to remove for a mover review.");
 if(parsed.data.type!=="MOVER"&&parsed.data.grantIds.length>0)throw new Error("Grant IDs are only used for mover requests.");
 if(parsed.data.type==="MOVER"){
  const count=await prisma.accessGrant.count({where:{id:{in:parsed.data.grantIds},organizationId:actor.organizationId,identityId:identity.id,status:"ACTIVE"}});
  if(count!==parsed.data.grantIds.length)throw new Error("One or more selected grants are not active grants for this identity.");
 }
 const pending=await prisma.lifecycleRequest.count({where:{organizationId:actor.organizationId,identityId:identity.id,status:"PENDING"}});
 if(pending)throw new Error("This identity already has a pending lifecycle request.");
 const request=await prisma.$transaction(async tx=>{
  const created=await tx.lifecycleRequest.create({data:{organizationId:actor.organizationId,identityId:identity.id,requesterUserId:actor.userId,type:parsed.data.type,reason:parsed.data.reason,grantIds:parsed.data.grantIds}});
  await tx.auditEvent.create({data:{organizationId:actor.organizationId,actorUserId:actor.userId,action:"lifecycle.request.created",targetType:"lifecycle_request",targetId:created.id,outcome:"SUCCESS",reason:parsed.data.reason,metadata:{identityId:identity.id,type:parsed.data.type,grantCount:parsed.data.grantIds.length}}});
  return created;
 });
 void request;
 revalidatePath("/lifecycle");
}
const decisionSchema=z.object({requestId:z.string().min(1),reason:z.string().trim().min(5).max(1200)});
export async function decideLifecycleRequest(formData:FormData):Promise<void>{
 const actor=await actorContext();await requireOrganizationRole(actor.organizationId,approverRoles);
 const parsed=decisionSchema.safeParse({requestId:formData.get("requestId"),reason:formData.get("reason")});
 if(!parsed.success)throw new Error("Provide a valid lifecycle request and decision rationale.");
 const request=await prisma.lifecycleRequest.findFirst({where:{id:parsed.data.requestId,organizationId:actor.organizationId,status:"PENDING"},include:{identity:{select:{id:true,status:true}}}});
 if(!request)throw new Error("Pending lifecycle request not found in this workspace.");
 const grantIds=Array.isArray(request.grantIds)&&request.grantIds.every(x=>typeof x==="string")?request.grantIds as string[]:[];
 await prisma.$transaction(async tx=>{
  const claimed=await tx.lifecycleRequest.updateMany({where:{id:request.id,organizationId:actor.organizationId,status:"PENDING"},data:{status:"COMPLETED",decisionUserId:actor.userId,decidedAt:new Date(),completedAt:new Date()}});
  if(claimed.count!==1)throw new Error("This request has already been processed.");
  if(request.type==="JOINER"){
   if(request.identity.status!=="PENDING")throw new Error("Joiner identity is no longer pending.");
   const changed=await tx.identity.updateMany({where:{id:request.identityId,organizationId:actor.organizationId,status:"PENDING"},data:{status:"ACTIVE"}});
   if(changed.count!==1)throw new Error("Identity state changed before approval.");
  }else if(request.type==="MOVER"){
   if(!grantIds.length)throw new Error("Mover request has no validated grant selection.");
   const revoked=await tx.accessGrant.updateMany({where:{id:{in:grantIds},organizationId:actor.organizationId,identityId:request.identityId,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date()}});
   if(revoked.count!==grantIds.length)throw new Error("One or more selected grants changed; no partial lifecycle action was applied.");
  }else{
   const changed=await tx.identity.updateMany({where:{id:request.identityId,organizationId:actor.organizationId,status:{not:"DISABLED"}},data:{status:"DISABLED"}});
   if(changed.count!==1)throw new Error("Identity is already disabled or has changed.");
   await tx.accessGrant.updateMany({where:{organizationId:actor.organizationId,identityId:request.identityId,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date()}});
  }
  await tx.auditEvent.create({data:{organizationId:actor.organizationId,actorUserId:actor.userId,action:"lifecycle.request.completed",targetType:"lifecycle_request",targetId:request.id,outcome:"SUCCESS",reason:parsed.data.reason,metadata:{identityId:request.identityId,type:request.type,grantIds,identityStatusAfter:request.type==="JOINER"?"ACTIVE":request.type==="LEAVER"?"DISABLED":request.identity.status}}});
  if(request.type!=="JOINER")await tx.auditEvent.create({data:{organizationId:actor.organizationId,actorUserId:actor.userId,action:request.type==="LEAVER"?"identity.offboarded":"identity.access_adjusted",targetType:"identity",targetId:request.identityId,outcome:"SUCCESS",reason:parsed.data.reason,metadata:{lifecycleRequestId:request.id,type:request.type,grantIds}}});
 });
 revalidatePath("/lifecycle");revalidatePath("/identities");revalidatePath("/governance");revalidatePath("/certifications");
}
export async function rejectLifecycleRequest(formData:FormData):Promise<void>{
 const actor=await actorContext();await requireOrganizationRole(actor.organizationId,approverRoles);
 const parsed=decisionSchema.safeParse({requestId:formData.get("requestId"),reason:formData.get("reason")});
 if(!parsed.success)throw new Error("Provide a valid lifecycle request and rejection rationale.");
 const request=await prisma.lifecycleRequest.findFirst({where:{id:parsed.data.requestId,organizationId:actor.organizationId,status:"PENDING"},select:{id:true,type:true,identityId:true}});
 if(!request)throw new Error("Pending lifecycle request not found.");
 await prisma.$transaction(async tx=>{
  const changed=await tx.lifecycleRequest.updateMany({where:{id:request.id,organizationId:actor.organizationId,status:"PENDING"},data:{status:"REJECTED",decisionUserId:actor.userId,decidedAt:new Date()}});
  if(changed.count!==1)throw new Error("This request has already been processed.");
  await tx.auditEvent.create({data:{organizationId:actor.organizationId,actorUserId:actor.userId,action:"lifecycle.request.rejected",targetType:"lifecycle_request",targetId:request.id,outcome:"SUCCESS",reason:parsed.data.reason,metadata:{identityId:request.identityId,type:request.type}}});
 });
 revalidatePath("/lifecycle");
}
