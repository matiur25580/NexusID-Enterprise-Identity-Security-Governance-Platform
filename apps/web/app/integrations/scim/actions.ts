"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma, withTenantContext } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { hashScimToken } from "@/lib/scim";
import { revalidatePath } from "next/cache";
import { MembershipRole } from "@prisma/client";
const managers:MembershipRole[]=["OWNER","ADMIN"];
async function actor(){
 const session=await auth();if(!session?.user?.id)throw new Error("Authentication required.");
 const membership=await prisma.membership.findFirst({where:{userId:session.user.id},orderBy:{createdAt:"asc"},select:{organizationId:true}});
 if(!membership)throw new Error("No workspace found.");
 await requireOrganizationRole(membership.organizationId,managers);
 return {userId:session.user.id,organizationId:membership.organizationId};
}
export async function createScimConnector(name:string):Promise<{token:string;name:string}>{
 const current=await actor();const parsed=z.string().trim().min(2).max(80).safeParse(name);
 if(!parsed.success)throw new Error("Connector name must be between 2 and 80 characters.");
 const token="nxs_scim_"+randomBytes(32).toString("base64url");
 const connector=await withTenantContext(current.organizationId, async tx=>{
  const created=await tx.scimConnector.create({data:{organizationId:current.organizationId,name:parsed.data,tokenHash:hashScimToken(token),createdById:current.userId}});
  await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.connector.created",targetType:"scim_connector",targetId:created.id,outcome:"SUCCESS",metadata:{name:created.name,tokenPrefix:"nxs_scim_"}}});
  return created;
 });
 revalidatePath("/integrations/scim");return {token,name:connector.name};
}
export async function revokeScimConnector(id:string):Promise<void>{
 const current=await actor();const parsed=z.string().min(1).safeParse(id);if(!parsed.success)throw new Error("Invalid connector.");
 await withTenantContext(current.organizationId, async tx=>{
  const changed=await tx.scimConnector.updateMany({where:{id:parsed.data,organizationId:current.organizationId,enabled:true},data:{enabled:false,revokedAt:new Date()}});
  if(changed.count!==1)throw new Error("Enabled connector not found in this workspace.");
  await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.connector.revoked",targetType:"scim_connector",targetId:id,outcome:"SUCCESS",reason:"Connector revoked by workspace administrator."}});
 });
 revalidatePath("/integrations/scim");
}

export async function createScimGroupMapping(groupId:string,entitlementId:string):Promise<void>{
 const current=await actor();
 const parsed=z.object({groupId:z.string().min(1),entitlementId:z.string().min(1)}).safeParse({groupId,entitlementId});
 if(!parsed.success)throw new Error("Choose a valid SCIM group and entitlement.");
 const [group,entitlement]=await withTenantContext(current.organizationId, tx=>Promise.all([
  tx.scimGroup.findFirst({where:{id:groupId,organizationId:current.organizationId},select:{id:true,connectorId:true,displayName:true}}),
  tx.entitlement.findFirst({where:{id:entitlementId,organizationId:current.organizationId,enabled:true},select:{id:true,name:true}})
 ]));
 if(!group||!entitlement)throw new Error("Group and enabled entitlement must belong to this workspace.");
 await withTenantContext(current.organizationId, async tx=>{const created=await tx.scimGroupEntitlementMapping.create({data:{organizationId:current.organizationId,groupId,entitlementId}});await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.group.entitlement_mapping.created",targetType:"scim_group_entitlement_mapping",targetId:created.id,outcome:"SUCCESS",metadata:{groupId,entitlementId}}});return created;});
 const connector=await withTenantContext(current.organizationId, tx=>tx.scimConnector.findFirst({where:{id:group.connectorId,organizationId:current.organizationId,enabled:true},select:{id:true,organizationId:true,createdById:true}}));
 if(connector)await (await import("@/lib/scim-group-sync")).syncGroupAccessRequests(groupId,connector);
 revalidatePath("/integrations/scim");revalidatePath("/governance");
}
export async function removeScimGroupMapping(mappingId:string):Promise<void>{
 const current=await actor();const parsed=z.string().min(1).safeParse(mappingId);if(!parsed.success)throw new Error("Invalid mapping.");
 await withTenantContext(current.organizationId, async tx=>{
  const mapping=await tx.scimGroupEntitlementMapping.findFirst({where:{id:mappingId,organizationId:current.organizationId},select:{id:true,groupId:true,entitlementId:true}});
  if(!mapping)throw new Error("Mapping not found in this workspace.");
  await tx.scimGroupEntitlementMapping.delete({where:{id:mapping.id}});
  await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.group.entitlement_mapping.removed",targetType:"scim_group_entitlement_mapping",targetId:mapping.id,outcome:"SUCCESS",metadata:{groupId:mapping.groupId,entitlementId:mapping.entitlementId},reason:"Mapping removed. Existing pending requests and active grants are not automatically changed."}});
 });
 revalidatePath("/integrations/scim");
}
