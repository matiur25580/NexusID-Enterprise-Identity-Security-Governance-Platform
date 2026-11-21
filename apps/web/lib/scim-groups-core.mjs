export function normalizeScimGroup(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("INVALID_SCIM_GROUP");
 const externalId=typeof input.externalId==="string"?input.externalId.trim():"";
 const displayName=typeof input.displayName==="string"?input.displayName.trim():"";
 if(!externalId||externalId.length>256)throw new Error("GROUP_EXTERNAL_ID_REQUIRED");
 if(!displayName||displayName.length>200)throw new Error("GROUP_DISPLAY_NAME_REQUIRED");
 const members=Array.isArray(input.members)?input.members.map(m=>{if(!m||typeof m.value!=="string"||!m.value.trim())throw new Error("INVALID_GROUP_MEMBER");return m.value.trim();}):[];
 if(members.length>1000||new Set(members).size!==members.length)throw new Error("INVALID_GROUP_MEMBERS");
 return {externalId,displayName,members};
}
export function applyScimGroupPatch(current,operations){
 if(!Array.isArray(operations)||operations.length===0||operations.length>100)throw new Error("INVALID_GROUP_PATCH");
 const next={...current,members:[...current.members]};
 for(const op of operations){
  if(!op||typeof op!=="object"||!["add","replace","remove"].includes(String(op.op??"").toLowerCase()))throw new Error("INVALID_GROUP_PATCH_OPERATION");
  const kind=String(op.op).toLowerCase(),path=String(op.path??"").toLowerCase();
  if(!path||path==="displayname"){
   if(kind==="remove")throw new Error("DISPLAY_NAME_REQUIRED");
   const value=path?op.value:op.value?.displayName;
   if(typeof value==="string")next.displayName=value.trim();
   else if(path)throw new Error("INVALID_GROUP_PATCH_VALUE");
   if(!path&&op.value?.members)next.members=normalizeMembers(op.value.members);
   if(!path&&typeof value!=="string"&&!op.value?.members)throw new Error("INVALID_GROUP_PATCH_VALUE");
   continue;
  }
  if(path==="members"){
   const values=normalizeMembers(Array.isArray(op.value)?op.value:op.value?.value?[op.value]:[]);
   if(kind==="replace")next.members=values;
   else if(kind==="add")next.members=[...new Set([...next.members,...values])];
   else next.members=next.members.filter(id=>!values.includes(id));
   continue;
  }
  throw new Error("UNSUPPORTED_GROUP_PATCH_PATH");
 }
 if(!next.displayName||next.displayName.length>200)throw new Error("GROUP_DISPLAY_NAME_REQUIRED");
 return next;
}
function normalizeMembers(values){if(!Array.isArray(values)||values.length>1000)throw new Error("INVALID_GROUP_MEMBERS");const ids=values.map(v=>typeof v==="string"?v:v?.value);if(ids.some(v=>typeof v!=="string"||!v.trim()))throw new Error("INVALID_GROUP_MEMBER");return [...new Set(ids.map(v=>v.trim()))];}
