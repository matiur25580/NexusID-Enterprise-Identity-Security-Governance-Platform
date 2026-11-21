"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationRole } from "@/lib/authorization";
import { hashScimToken } from "@/lib/scim.mjs";
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
 const connector=await prisma.$transaction(async tx=>{
  const created=await tx.scimConnector.create({data:{organizationId:current.organizationId,name:parsed.data,tokenHash:hashScimToken(token),createdById:current.userId}});
  await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.connector.created",targetType:"scim_connector",targetId:created.id,outcome:"SUCCESS",metadata:{name:created.name,tokenPrefix:"nxs_scim_"}}});
  return created;
 });
 revalidatePath("/integrations/scim");return {token,name:connector.name};
}
export async function revokeScimConnector(id:string):Promise<void>{
 const current=await actor();const parsed=z.string().min(1).safeParse(id);if(!parsed.success)throw new Error("Invalid connector.");
 await prisma.$transaction(async tx=>{
  const changed=await tx.scimConnector.updateMany({where:{id:parsed.data,organizationId:current.organizationId,enabled:true},data:{enabled:false,revokedAt:new Date()}});
  if(changed.count!==1)throw new Error("Enabled connector not found in this workspace.");
  await tx.auditEvent.create({data:{organizationId:current.organizationId,actorUserId:current.userId,action:"scim.connector.revoked",targetType:"scim_connector",targetId:id,outcome:"SUCCESS",reason:"Connector revoked by workspace administrator."}});
 });
 revalidatePath("/integrations/scim");
}
