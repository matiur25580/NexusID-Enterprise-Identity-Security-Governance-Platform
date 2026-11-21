import type { NextResponse } from "next/server";
export const SCIM_USER_SCHEMA:string;
export const SCIM_LIST_SCHEMA:string;
export function scimError(status:number,detail:string,type?:string):NextResponse;
export function authenticateScim(request:Request):Promise<{id:string;organizationId:string;enabled:boolean}|null>;
export function createScimToken():string;
export function hashScimToken(token:string):string;
export function toScimUser(identity:{id:string;externalId:string|null;userName:string|null;displayName:string;email:string|null;status:string;createdAt:Date;updatedAt:Date},request:Request):Record<string,unknown>;
