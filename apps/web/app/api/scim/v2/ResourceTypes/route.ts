import { authenticateScim,scimError } from "@/lib/scim";
import { NextResponse } from "next/server";
export async function GET(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 return NextResponse.json({schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],totalResults:1,startIndex:1,itemsPerPage:1,Resources:[{schemas:["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],id:"User",name:"User",endpoint:"/Users",description:"NexusID workforce identity resource.",schema:"urn:ietf:params:scim:schemas:core:2.0:User",meta:{resourceType:"ResourceType",location:"/api/scim/v2/ResourceTypes/User"}}]},{headers:{"Content-Type":"application/scim+json"}});
}
