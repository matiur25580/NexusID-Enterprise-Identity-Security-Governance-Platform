import { withTenantContext } from "@/lib/prisma";
import { authenticateScim,scimError } from "@/lib/scim";
import { applyScimGroupPatch,normalizeScimGroup } from "@/lib/scim-groups-core.mjs";
import { syncGroupAccessRequests } from "@/lib/scim-group-sync";
import { NextResponse } from "next/server";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
async function load(request:Request,id:string){
 const connector=await authenticateScim(request);if(!connector)return {error:scimError(401,"A valid SCIM bearer token is required.","invalidCredentials")} as const;
 const group=await withTenantContext(connector.organizationId, tx=>tx.scimGroup.findFirst({where:{id,organizationId:connector.organizationId,connectorId:connector.id},include:{members:{where:{identity:{organizationId:connector.organizationId,source:"SCIM:"+connector.id}},select:{identityId:true}}}}));
 if(!group)return {error:scimError(404,"SCIM Group not found.")} as const;
 return {connector,group} as const;
}
function body(group:{id:string;externalId:string;displayName:string;createdAt:Date;updatedAt:Date;members:{identityId:string}[]}){
 return {schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"],id:group.id,externalId:group.externalId,displayName:group.displayName,members:group.members.map(m=>({value:m.identityId,type:"User"})),meta:{resourceType:"Group",created:group.createdAt.toISOString(),lastModified:group.updatedAt.toISOString()}};
}
export async function GET(request:Request,{params}:Context){const {id}=await params;const r=await load(request,id);if("error"in r)return r.error;return NextResponse.json(body(r.group),{headers:{"Content-Type":"application/scim+json"}});}
async function persist(request:Request,id:string,connector:{id:string;organizationId:string;createdById:string},next:{displayName:string;members:string[]}){
 const {identities,old}=await withTenantContext(connector.organizationId, async tx=>({
  identities:await tx.identity.findMany({where:{id:{in:next.members},organizationId:connector.organizationId,source:"SCIM:"+connector.id},select:{id:true}}),
  old:await tx.scimGroup.findFirst({where:{id,organizationId:connector.organizationId,connectorId:connector.id},include:{members:{select:{identityId:true}}}})
 }));
 if(identities.length!==next.members.length)return scimError(400,"Every group member must be a User provisioned by this connector.");
 if(!old)return scimError(404,"SCIM Group not found.");
 const removed=old.members.map(m=>m.identityId).filter(v=>!next.members.includes(v));
 const group=await withTenantContext(connector.organizationId, async tx=>{
  const updated=await tx.scimGroup.update({where:{id,organizationId:connector.organizationId,connectorId:connector.id},data:{displayName:next.displayName,members:{deleteMany:{},create:next.members.map(identityId=>({identityId}))},updatedAt:new Date()},include:{members:{select:{identityId:true}}}});
  await tx.auditEvent.create({data:{organizationId:connector.organizationId,actorUserId:connector.createdById,action:"scim.group.updated",targetType:"scim_group",targetId:id,outcome:"SUCCESS",metadata:{connectorId:connector.id,memberCount:next.members.length,removedMemberCount:removed.length}}});
  return updated;
 });
 await syncGroupAccessRequests(id,connector);
 return NextResponse.json(body(group),{headers:{"Content-Type":"application/scim+json"}});
}
export async function PUT(request:Request,{params}:Context){
 const {id}=await params,r=await load(request,id);if("error"in r)return r.error;
 let parsed;try{parsed=normalizeScimGroup({...await request.json(),externalId:r.group.externalId});}catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM Group.");}
 return persist(request,id,r.connector,parsed);
}
export async function PATCH(request:Request,{params}:Context){
 const {id}=await params,r=await load(request,id);if("error"in r)return r.error;
 let bodyInput;try{bodyInput=await request.json();}catch{return scimError(400,"Invalid JSON body.");}
 try{
  const next=applyScimGroupPatch({displayName:r.group.displayName,members:r.group.members.map(m=>m.identityId)},bodyInput?.Operations);
  return persist(request,id,r.connector,next);
 }catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM Group PATCH.");}
}
export async function DELETE(request:Request,{params}:Context){
 const {id}=await params,r=await load(request,id);if("error"in r)return r.error;
 await withTenantContext(r.connector.organizationId, async tx=>{
  await tx.scimGroup.delete({where:{id,organizationId:r.connector.organizationId,connectorId:r.connector.id}});
  await tx.auditEvent.create({data:{organizationId:r.connector.organizationId,actorUserId:r.connector.createdById,action:"scim.group.deleted",targetType:"scim_group",targetId:id,outcome:"SUCCESS",reason:"SCIM group deleted. Existing access requests and grants are not automatically revoked."}});
 });
 return new NextResponse(null,{status:204});
}
