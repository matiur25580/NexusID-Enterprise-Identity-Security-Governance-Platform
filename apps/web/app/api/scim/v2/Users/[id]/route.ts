import { prisma, withTenantContext } from "@/lib/prisma";
import { authenticateScim, scimError, toScimUser } from "@/lib/scim";
import { normalizeScimUser, applyScimPatch } from "@/lib/scim-core.mjs";
import { NextResponse } from "next/server";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
async function load(request:Request,id:string){
 const connector=await authenticateScim(request);if(!connector)return {error:scimError(401,"A valid SCIM bearer token is required.","invalidCredentials")} as const;
 const identity=await prisma.identity.findFirst({where:{id,organizationId:connector.organizationId,source:"SCIM:"+connector.id}});
 if(!identity)return {error:scimError(404,"SCIM User not found.")} as const;
 return {connector,identity} as const;
}
export async function GET(request:Request,{params}:Context){
 const {id}=await params;const result=await load(request,id);if("error"in result)return result.error;
 return NextResponse.json(toScimUser(result.identity,request),{headers:{"Content-Type":"application/scim+json"}});
}
async function persist(request:Request,id:string,connectorId:string,organizationId:string,next:{userName:string;externalId:string|null;displayName:string;email:string|null;active:boolean}){
 const current=await prisma.identity.findFirst({where:{id,organizationId,source:"SCIM:"+connectorId}});if(!current)return scimError(404,"SCIM User not found.");
 try{
  const identity=await withTenantContext(organizationId, async tx=>{
   const updated=await tx.identity.update({where:{id},data:{userName:next.userName,externalId:next.externalId,displayName:next.displayName,email:next.email,status:next.active?"ACTIVE":"DISABLED",source:"SCIM:"+connectorId}});
   let revokedCount=0;
   if(!next.active){const revoked=await tx.accessGrant.updateMany({where:{organizationId,identityId:id,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date()}});revokedCount=revoked.count;}
   await tx.auditEvent.create({data:{organizationId,action:"scim.user.updated",targetType:"identity",targetId:id,outcome:"SUCCESS",reason:next.active?"Identity attributes synchronized through SCIM.":"SCIM deactivation disabled identity and revoked active grants.",metadata:{connectorId,userName:next.userName,active:next.active,grantsRevoked:revokedCount}}});
   return updated;
  });
  return NextResponse.json(toScimUser(identity,request),{headers:{"Content-Type":"application/scim+json"}});
 }catch(e){if(e&&typeof e==="object"&&"code"in e&&e.code==="P2002")return scimError(409,"A userName or externalId already exists in this organization.","uniqueness");throw e;}
}
export async function PUT(request:Request,{params}:Context){
 const {id}=await params;const result=await load(request,id);if("error"in result)return result.error;
 let next;try{next=normalizeScimUser(await request.json());}catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM User payload.");}
 return persist(request,id,result.connector.id,result.connector.organizationId,next);
}
export async function PATCH(request:Request,{params}:Context){
 const {id}=await params;const result=await load(request,id);if("error"in result)return result.error;
 let body;try{body=await request.json();}catch{return scimError(400,"Invalid JSON body.");}
 try{
  const current={userName:result.identity.userName??result.identity.email??"",externalId:result.identity.externalId,displayName:result.identity.displayName,email:result.identity.email,active:result.identity.status==="ACTIVE"};
  const next=applyScimPatch(current,body?.Operations);
  return persist(request,id,result.connector.id,result.connector.organizationId,next);
 }catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM PATCH request.");}
}
export async function DELETE(request:Request,{params}:Context){
 const {id}=await params;const result=await load(request,id);if("error"in result)return result.error;
 await withTenantContext(organizationId, async tx=>{
  await tx.identity.update({where:{id},data:{status:"DISABLED",source:"SCIM:"+result.connector.id}});
  const revoked=await tx.accessGrant.updateMany({where:{organizationId:result.connector.organizationId,identityId:id,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date()}});
  await tx.auditEvent.create({data:{organizationId:result.connector.organizationId,action:"scim.user.deactivated",targetType:"identity",targetId:id,outcome:"SUCCESS",reason:"SCIM DELETE deactivated the identity and revoked active grants.",metadata:{connectorId:result.connector.id,grantsRevoked:revoked.count}}});
 });
 return new NextResponse(null,{status:204});
}
