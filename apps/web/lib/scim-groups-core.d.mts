export function normalizeScimGroup(input: unknown): {externalId:string;displayName:string;members:string[]};
export function applyScimGroupPatch(current:{displayName:string;members:string[]},operations:unknown):{displayName:string;members:string[]};

export function scimGroupRequestMarker(groupId: string, entitlementId: string): string;
export function isScimGroupRequestFor(reason: unknown, groupId: string, entitlementId: string): boolean;
