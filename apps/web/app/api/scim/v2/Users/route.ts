import { prisma } from "@/lib/prisma";
import { authenticateScim, scimError, toScimUser, SCIM_LIST_SCHEMA } from "@/lib/scim.mjs";
import { normalizeScimUser, parseScimFilter } from "@/lib/scim-core.mjs";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 const url=new URL(request.url);let filter;
 try{filter=parseScimFilter(url.searchParams.get("filter")??"");}catch{return scimError(400,"Only exact userName or externalId equality filters are supported.","invalidFilter");}
 const startIndex=Math.min(100000,Math.max(1,Number(url.searchParams.get("startIndex")??1)||1)),count=Math.min(100,Math.max(1,Number(url.searchParams.get("count")??50)||50));
 const where:Prisma.IdentityWhereInput={organizationId:connector.organizationId,...(filter?{[filter.field]:filter.value}:{})};
 const [total,identities]=await Promise.all([prisma.identity.count({where}),prisma.identity.findMany({where,orderBy:{createdAt:"desc"},skip:startIndex-1,take:count})]);
 return NextResponse.json({schemas:[SCIM_LIST_SCHEMA],totalResults:total,startIndex,itemsPerPage:identities.length,Resources:identities.map(i=>toScimUser(i,request))},{headers:{"Content-Type":"application/scim+json"}});
}
export async function POST(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 let payload;try{payload=normalizeScimUser(await request.json());}catch(e){return scimError(400,e instanceof Error?e.message:"Invalid SCIM user payload.");}
 try{
  const result=await prisma.$transaction(async tx=>{
   const identity=await tx.identity.create({data:{organizationId:connector.organizationId,externalId:payload.externalId,userName:payload.userName,displayName:payload.displayName,email:payload.email,type:"HUMAN",status:payload.active?"ACTIVE":"DISABLED",source:"SCIM:"+connector.id}});
   await tx.auditEvent.create({data:{organizationId:connector.organizationId,action:"scim.user.created",targetType:"identity",targetId:identity.id,outcome:"SUCCESS",reason:"Identity provisioned through an authenticated SCIM connector.",metadata:{connectorId:connector.id,userName:payload.userName,active:payload.active}}});
   return identity;
  });
  return NextResponse.json(toScimUser(result,request),{status:201,headers:{"Content-Type":"application/scim+json","Location":new URL(request.url).origin+"/api/scim/v2/Users/"+result.id}});
 }catch(e){if(e&&typeof e==="object"&&"code"in e&&e.code==="P2002")return scimError(409,"A userName or externalId already exists in this organization.","uniqueness");throw e;}
}
