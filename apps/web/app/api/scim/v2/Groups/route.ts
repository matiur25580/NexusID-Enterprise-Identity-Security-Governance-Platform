import { prisma } from "@/lib/prisma";
import { authenticateScim,scimError } from "@/lib/scim";
import { normalizeScimGroup } from "@/lib/scim-groups-core.mjs";
import { syncGroupAccessRequests } from "@/lib/scim-group-sync";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 const url=new URL(request.url),startIndex=Math.min(100000,Math.max(1,Number(url.searchParams.get("startIndex")??1)||1)),count=Math.min(100,Math.max(1,Number(url.searchParams.get("count")??50)||50));
 const filter=url.searchParams.get("filter");let externalId:string|undefined;
 if(filter){const match=filter.match(/^\s*displayName\s+eq\s+"([^"]{1,200})"\s*$/i);if(!match)return scimError(400,"Only exact displayName equality is supported.","invalidFilter");externalId=match[1];}
 const where={organizationId:connector.organizationId,connectorId:connector.id,...(externalId?{displayName:externalId}:{})};
 const [total,groups]=await Promise.all([prisma.scimGroup.count({where}),prisma.scimGroup.findMany({where,include:{members:{select:{identityId:true}}},orderBy:{createdAt:"desc"},skip:startIndex-1,take:count})]);
 return NextResponse.json({schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],totalResults:total,startIndex,itemsPerPage:groups.length,Resources:groups.map(g=>({schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"],id:g.id,externalId:g.externalId,displayName:g.displayName,members:g.members.map(m=>({value:m.identityId,type:"User"})),meta:{resourceType:"Group",created:g.createdAt.toISOString(),lastModified:g.updatedAt.toISOString()}}))},{headers:{"Content-Type":"application/scim+json"}});
}
export async function POST(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 let input;try{input=normalizeScimGroup(await request.json());}catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM Group.");}
 const identities=await prisma.identity.findMany({where:{id:{in:input.members},organizationId:connector.organizationId,source:"SCIM:"+connector.id},select:{id:true}});
 if(identities.length!==input.members.length)return scimError(400,"Every group member must be a User provisioned by this connector.");
 try{
  const group=await prisma.$transaction(async tx=>{
   const created=await tx.scimGroup.create({data:{organizationId:connector.organizationId,connectorId:connector.id,externalId:input.externalId,displayName:input.displayName,members:{create:input.members.map(identityId=>({identityId}))}}});
   await tx.auditEvent.create({data:{organizationId:connector.organizationId,actorUserId:connector.createdById,action:"scim.group.created",targetType:"scim_group",targetId:created.id,outcome:"SUCCESS",metadata:{connectorId:connector.id,externalId:created.externalId,memberCount:input.members.length}}});
   return created;
  });
  await syncGroupAccessRequests(group.id,connector);
  return NextResponse.json({schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"],id:group.id,externalId:group.externalId,displayName:group.displayName,members:input.members.map(value=>({value,type:"User"}))},{status:201,headers:{"Content-Type":"application/scim+json","Location":new URL(request.url).origin+"/api/scim/v2/Groups/"+group.id}});
 }catch(e){if(e&&typeof e==="object"&&"code"in e&&e.code==="P2002")return scimError(409,"This externalId already exists for the connector.","uniqueness");throw e;}
}
