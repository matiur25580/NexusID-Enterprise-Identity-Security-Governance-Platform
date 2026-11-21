export type IdentityRiskGrant = { riskLevel?: string | null; privileged?: boolean | null };
export type IdentityRiskInput = { status: string; type: string; lastSeenAt?: Date | string | null; activeGrants?: IdentityRiskGrant[] | null };
export type IdentityRiskFactor = { code: string; label: string; points: number; explanation: string };
export type IdentityRiskResult = { score: number; level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"; factors: IdentityRiskFactor[]; methodology: "NEXUSID_DETERMINISTIC_V1" };
const DAY_MS = 24 * 60 * 60 * 1000;
/** Transparent heuristic score, not a probability or ML prediction. Missing last-seen data is neutral. */
export function calculateIdentityRisk(input: IdentityRiskInput, asOf: Date = new Date()): IdentityRiskResult {
  const factors: IdentityRiskFactor[] = [];
  const add = (code: string, label: string, points: number, explanation: string) => { if (points > 0) factors.push({ code, label, points, explanation }); };
  if (input.status === "DISABLED") add("IDENTITY_DISABLED", "Disabled identity", 50, "Disabled identities require investigation before any access is retained.");
  else if (input.status === "SUSPENDED") add("IDENTITY_SUSPENDED", "Suspended identity", 35, "Suspended identities should not retain active access without an explicit exception.");
  else if (input.status === "PENDING") add("IDENTITY_PENDING", "Pending identity", 15, "Identity activation or ownership has not yet been confirmed.");
  if (input.type !== "HUMAN") add("NON_HUMAN_IDENTITY", "Non-human identity", 15, "Service, workload and AI-agent identities need explicit ownership and lifecycle controls.");
  if (input.lastSeenAt != null) {
    const lastSeen = input.lastSeenAt instanceof Date ? input.lastSeenAt : new Date(input.lastSeenAt);
    if (!Number.isNaN(lastSeen.getTime()) && asOf.getTime() - lastSeen.getTime() > 90 * DAY_MS) add("STALE_IDENTITY", "No recent activity", 10, "The last-seen timestamp is more than 90 days old.");
  }
  const grants = input.activeGrants ?? [];
  const criticalCount = grants.filter((grant) => grant.riskLevel?.toUpperCase() === "CRITICAL").length;
  const highCount = grants.filter((grant) => grant.riskLevel?.toUpperCase() === "HIGH").length;
  const privilegedCount = grants.filter((grant) => grant.privileged === true).length;
  if (criticalCount) add("CRITICAL_ACCESS", "Critical-risk access", Math.min(50, criticalCount * 25), `${criticalCount} active grant(s) reference critical-risk entitlements; contribution capped at 50.`);
  if (highCount) add("HIGH_RISK_ACCESS", "High-risk access", Math.min(30, highCount * 15), `${highCount} active grant(s) reference high-risk entitlements; contribution capped at 30.`);
  if (privilegedCount) add("PRIVILEGED_ACCESS", "Privileged access", Math.min(30, privilegedCount * 15), `${privilegedCount} active grant(s) are marked privileged; contribution capped at 30.`);
  if (grants.length > 10) add("ACCESS_VOLUME", "High access volume", 10, `${grants.length} active grants exceed the 10-grant review threshold.`);
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  const level = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW";
  return { score, level, factors, methodology: "NEXUSID_DETERMINISTIC_V1" };
}
