const allowed=new Set(["userName","externalId","displayName","active","emails","name"]);
export function normalizeScimUser(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("INVALID_SCIM_USER");
 const userName=typeof input.userName==="string"?input.userName.trim():"";
 if(!userName||userName.length>256)throw new Error("USERNAME_REQUIRED");
 if(input.active!==undefined&&typeof input.active!=="boolean")throw new Error("ACTIVE_MUST_BE_BOOLEAN");
 const emails=Array.isArray(input.emails)?input.emails:[];
 const primary=emails.find(e=>e&&typeof e.value==="string"&&e.primary===true)??emails.find(e=>e&&typeof e.value==="string");
 const email=primary?.value?.trim()||null;
 if(email&&email.length>320)throw new Error("INVALID_EMAIL");
 const externalId=typeof input.externalId==="string"&&input.externalId.trim()?input.externalId.trim():null;
 const displayName=typeof input.displayName==="string"&&input.displayName.trim()?input.displayName.trim():typeof input.name?.formatted==="string"&&input.name.formatted.trim()?input.name.formatted.trim():userName;
 if(displayName.length>200||(externalId&&externalId.length>256))throw new Error("SCIM_FIELD_TOO_LONG");
 return {userName,externalId,displayName,email,active:input.active!==false};
}
export function applyScimPatch(current,operations){
 if(!Array.isArray(operations)||operations.length===0||operations.length>100)throw new Error("INVALID_PATCH_OPERATIONS");
 const next={...current};
 for(const operation of operations){
  if(!operation||typeof operation!=="object"||!["add","replace","remove"].includes(String(operation.op??"").toLowerCase()))throw new Error("INVALID_PATCH_OPERATION");
  const op=String(operation.op).toLowerCase(),path=String(operation.path??"").toLowerCase();
  if(!path&&operation.value&&typeof operation.value==="object"&&!Array.isArray(operation.value)){
   for(const key of Object.keys(operation.value)){if(!allowed.has(key))throw new Error("UNSUPPORTED_PATCH_PATH");applyScimField(next,key,operation.value[key],op);}
  }else{
   const key=path.split("[")[0].split(".")[0];
   if(!["active","username","externalid","displayname","email","emails","name"].includes(key))throw new Error("UNSUPPORTED_PATCH_PATH");
   applyScimField(next,key,operation.value,op);
  }
 }
 if(!next.userName||next.userName.length>256||!next.displayName||next.displayName.length>200)throw new Error("INVALID_PATCH_RESULT");
 if(next.email&&next.email.length>320)throw new Error("INVALID_EMAIL");
 return next;
}
function applyScimField(target,key,value,op){
 if(key==="active"){if(op==="remove")target.active=false;else if(typeof value!=="boolean")throw new Error("ACTIVE_MUST_BE_BOOLEAN");else target.active=value;return;}
 if(key==="emails"||key==="email"){const email=Array.isArray(value)?(value.find(e=>e&&e.primary)?.value??value[0]?.value):value;if(op==="remove"){target.email=null;return;}if(typeof email!=="string"||email.length>320)throw new Error("INVALID_PATCH_VALUE");target.email=email.trim();return;}
 if(key==="name"){value=value?.formatted;if(value===undefined&&op!=="remove")throw new Error("INVALID_PATCH_VALUE");key="displayName";}
 if(key==="username")key="userName";if(key==="externalid")key="externalId";if(key==="displayname")key="displayName";
 if(op==="remove"){target[key]=key==="externalId"?null:"";return;}
 if(typeof value!=="string"||value.length>(key==="displayName"?200:256))throw new Error("INVALID_PATCH_VALUE");
 target[key]=value.trim();
}
export function parseScimFilter(filter){
 if(!filter)return null;
 const match=String(filter).match(/^\s*(userName|externalId)\s+eq\s+"([^"]{1,256})"\s*$/i);
 if(!match)throw new Error("UNSUPPORTED_FILTER");
 return {field:match[1].toLowerCase()==="username"?"userName":"externalId",value:match[2]};
}
