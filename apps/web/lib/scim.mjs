import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const SCIM_USER_SCHEMA="urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA="urn:ietf:params:scim:api:messages:2.0:ListResponse";
export function scimError(status:number,detail:string,type="invalidValue"){
 return NextResponse.json({schemas:["urn:ietf:params:scim:api:messages:2.0:Error"],status:String(status),scimType:type,detail},{status,headers:{"Content-Type":"application/scim+json"}});
}
export async function authenticateScim(request:Request){
 const header=request.headers.get("authorization")??"";
 const match=header.match(/^Bearer\\s+(\\S+)$/i);
 if(!match||match[1].length>256)return null;
 const tokenHash=createHash("sha256").update(match[1]).digest("hex");
 const connector=await prisma.scimConnector.findUnique({where:{tokenHash},select:{id:true,organizationId:true,enabled:true}});
 if(!connector?.enabled)return null;
 await prisma.scimConnector.update({where:{id:connector.id},data:{lastUsedAt:new Date()}});
 return connector;
}
export function createScimToken(){return "nxs_scim_"+randomBytes(32).toString("base64url");}
export function hashScimToken(token:string){return createHash("sha256").update(token).digest("hex");}
export function toScimUser(identity:{id:string;externalId:string|null;userName:string|null;displayName:string;email:string|null;status:string;createdAt:Date;updatedAt:Date},request:Request){
 const url=new URL(request.url);
 return {schemas:[SCIM_USER_SCHEMA],id:identity.id,externalId:identity.externalId??undefined,userName:identity.userName??identity.email??identity.id,displayName:identity.displayName,active:identity.status==="ACTIVE",emails:identity.email?[{value:identity.email,type:"work",primary:true}]:[],meta:{resourceType:"User",created:identity.createdAt.toISOString(),lastModified:identity.updatedAt.toISOString(),location:url.origin+"/api/scim/v2/Users/"+identity.id,version:'W/"'+identity.updatedAt.getTime()+'"'}};
}
