import type { IdentityRiskResult } from "@/lib/identity-risk";
export type RiskAlertCandidate = { alertType: "CRITICAL_THRESHOLD" | "RISK_SPIKE"; previousScore: number; currentScore: number; scoreDelta: number };
export function detectRiskEscalations(previousScore: number | null, current: Pick<IdentityRiskResult, "score">): RiskAlertCandidate[] {
 const previous=previousScore??0, delta=current.score-previous; const alerts:RiskAlertCandidate[]=[];
 if(current.score>=75&&previous<75)alerts.push({alertType:"CRITICAL_THRESHOLD",previousScore:previous,currentScore:current.score,scoreDelta:delta});
 if(delta>=15)alerts.push({alertType:"RISK_SPIKE",previousScore:previous,currentScore:current.score,scoreDelta:delta});
 return alerts;
}