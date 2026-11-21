export function normalizeScimUser(input:unknown):{userName:string;externalId:string|null;displayName:string;email:string|null;active:boolean};
export function applyScimPatch(current:{userName:string;externalId:string|null;displayName:string;email:string|null;active:boolean},operations:unknown[]):{userName:string;externalId:string|null;displayName:string;email:string|null;active:boolean};
export function parseScimFilter(filter:string):{field:"userName"|"externalId";value:string}|null;
