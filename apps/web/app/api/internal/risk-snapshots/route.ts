import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withTenantContext } from "@/lib/prisma";
import { calculateIdentityRisk } from "@/lib/identity-risk";
import { detectRiskEscalations } from "@/lib/risk-alerts";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Protect the scheduled risk-snapshot job with a sufficiently strong, constant-time checked secret.
function authorized(request:NextRequest):boolean{
 const expected=process.env.NEXUSID_RISK_SNAPSHOT_SECRET;
 const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
 if(!expected||expected.length<32||supplied.length!==expected.length)return false;
 return timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
}
export async function POST(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 const now=new Date(), capturedOn=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 const organizations=await prisma.organization.findMany({select:{id:true}});
 let captured=0, alertCandidates=0;
 for(const organization of organizations){
  const {identities,previous}=await withTenantContext(organization.id,async tx=>{
   const scopedIdentities=await tx.identity.findMany({where:{organizationId:organization.id},select:{id:true,status:true,type:true,lastSeenAt:true,accessGrants:{where:{organizationId:organization.id,status:"ACTIVE"},select:{entitlement:{select:{riskLevel:true,privileged:true}}}}}});
   if(!scopedIdentities.length)return {identities:scopedIdentities,previous:[]};
   const prior=await tx.identityRiskSnapshot.findMany({where:{organizationId:organization.id,identityId:{in:scopedIdentities.map(x=>x.id)},capturedOn:{lt:capturedOn}},orderBy:{capturedOn:"desc"},select:{identityId:true,score:true}});
   return {identities:scopedIdentities,previous:prior};
  });
  if(!identities.length)continue;
  const previousByIdentity=new Map<string,number>();for(const item of previous)if(!previousByIdentity.has(item.identityId))previousByIdentity.set(item.identityId,item.score);
  const snapshots=identities.map(identity=>{const risk=calculateIdentityRisk({status:identity.status,type:identity.type,lastSeenAt:identity.lastSeenAt,activeGrants:identity.accessGrants.map(g=>g.entitlement)},now);return{organizationId:organization.id,identityId:identity.id,score:risk.score,level:risk.level,factors:risk.factors as Prisma.InputJsonArray,methodology:risk.methodology,capturedOn};});
  const alerts=snapshots.flatMap(s=>detectRiskEscalations(previousByIdentity.get(s.identityId)??null,{score:s.score}).map(a=>({...a,organizationId:organization.id,identityId:s.identityId,capturedOn})));
  await withTenantContext(organization.id, async tx=>{await tx.identityRiskSnapshot.createMany({data:snapshots,skipDuplicates:true});if(alerts.length)await tx.identityRiskAlert.createMany({data:alerts,skipDuplicates:true});await tx.auditEvent.create({data:{organizationId:organization.id,action:"identity.risk_assessment.completed",targetType:"identity_risk_assessment",outcome:"SUCCESS",reason:"Scheduled deterministic identity risk assessment completed.",metadata:{capturedOn:capturedOn.toISOString().slice(0,10),identityCount:snapshots.length,alertCandidates:alerts.length,methodology:"NEXUSID_DETERMINISTIC_V1"}}});});
  captured+=snapshots.length;alertCandidates+=alerts.length;
 }
 return NextResponse.json({success:true,capturedOn:capturedOn.toISOString().slice(0,10),organizations:organizations.length,identitiesCaptured:captured,alertCandidates});
}