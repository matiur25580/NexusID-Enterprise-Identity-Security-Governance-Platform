import test from "node:test";
import assert from "node:assert/strict";
function lifecyclePlan(type,identityStatus,activeGrantIds,selectedGrantIds=[]){
 if(type==="JOINER"&&identityStatus!=="PENDING")throw new Error("JOINER_REQUIRES_PENDING");
 if(type==="LEAVER"&&identityStatus==="DISABLED")throw new Error("IDENTITY_ALREADY_DISABLED");
 if(type==="MOVER"&&!selectedGrantIds.length)throw new Error("MOVER_REQUIRES_GRANTS");
 if(type!=="MOVER"&&selectedGrantIds.length)throw new Error("GRANTS_ONLY_FOR_MOVER");
 if(selectedGrantIds.some(id=>!activeGrantIds.includes(id)))throw new Error("GRANT_NOT_ACTIVE_FOR_IDENTITY");
 return type==="JOINER"?{identityStatus:"ACTIVE",revokeGrantIds:[]}:type==="LEAVER"?{identityStatus:"DISABLED",revokeGrantIds:[...activeGrantIds]}:{identityStatus, revokeGrantIds:[...selectedGrantIds]};
}
test("joiner only activates pending identities",()=>assert.deepEqual(lifecyclePlan("JOINER","PENDING",[]),{identityStatus:"ACTIVE",revokeGrantIds:[]}));
test("joiner cannot reactivate a disabled identity",()=>assert.throws(()=>lifecyclePlan("JOINER","DISABLED",[]),/JOINER_REQUIRES_PENDING/));
test("mover removes only selected active grants",()=>assert.deepEqual(lifecyclePlan("MOVER","ACTIVE",["a","b"],["b"]),{identityStatus:"ACTIVE",revokeGrantIds:["b"]}));
test("mover requires a selected grant",()=>assert.throws(()=>lifecyclePlan("MOVER","ACTIVE",["a"]),/MOVER_REQUIRES_GRANTS/));
test("mover rejects grants outside identity active grants",()=>assert.throws(()=>lifecyclePlan("MOVER","ACTIVE",["a"],["foreign"]),/GRANT_NOT_ACTIVE_FOR_IDENTITY/));
test("leaver disables identity and revokes all active grants",()=>assert.deepEqual(lifecyclePlan("LEAVER","ACTIVE",["a","b"]),{identityStatus:"DISABLED",revokeGrantIds:["a","b"]}));
test("leaver cannot be repeated for disabled identity",()=>assert.throws(()=>lifecyclePlan("LEAVER","DISABLED",[]),/IDENTITY_ALREADY_DISABLED/));
test("non-mover event cannot carry grant selections",()=>assert.throws(()=>lifecyclePlan("JOINER","PENDING",[],["a"]),/GRANTS_ONLY_FOR_MOVER/));
