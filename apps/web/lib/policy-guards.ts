export type VersionedPolicy = { version: number; validatedVersion: number | null };
export function hasFreshPolicySimulation(rule: VersionedPolicy): boolean {
  return Number.isInteger(rule.version) && rule.version > 0 && rule.validatedVersion === rule.version;
}
export function approvalMustBeBlocked(outcome: string): boolean { return outcome === "DENY"; }
export function tenantScopedWhere<T extends Record<string, unknown>>(organizationId: string, filters: T): T & { organizationId: string } {
  return { ...filters, organizationId };
}
