import { authenticateScim,scimError } from "@/lib/scim";
import { NextResponse } from "next/server";
export async function GET(request:Request){
 const connector=await authenticateScim(request);if(!connector)return scimError(401,"A valid SCIM bearer token is required.","invalidCredentials");
 return NextResponse.json({schemas:["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],documentationUri:"https://www.rfc-editor.org/rfc/rfc7644",patch:{supported:true},bulk:{supported:false},filter:{supported:true,maxResults:100},changePassword:{supported:false},sort:{supported:false},etag:{supported:false},authenticationSchemes:[{type:"oauthbearertoken",name:"Bearer Token",description:"Tenant-bound SCIM connector token.",specUri:"https://www.rfc-editor.org/rfc/rfc6750",primary:true}]},{headers:{"Content-Type":"application/scim+json"}});
}
