import test from "node:test";
import assert from "node:assert/strict";
import {planLifecycleTransition} from "../apps/web/lib/lifecycle-policy.mjs";
test("joiner only activates pending identities",()=>assert.deepEqual(planLifecycleTransition({type:"JOINER",identityStatus:"PENDING",activeGrantIds:[]}),{identityStatus:"ACTIVE",revokeGrantIds:[]}));
test("joiner cannot reactivate a disabled identity",()=>assert.throws(()=>planLifecycleTransition({type:"JOINER",identityStatus:"DISABLED",activeGrantIds:[]}),/JOINER_REQUIRES_PENDING/));
test("mover removes only selected active grants",()=>assert.deepEqual(planLifecycleTransition({type:"MOVER",identityStatus:"ACTIVE",activeGrantIds:["a","b"],selectedGrantIds:["b"]}),{identityStatus:"ACTIVE",revokeGrantIds:["b"]}));
test("mover requires a selected grant",()=>assert.throws(()=>planLifecycleTransition({type:"MOVER",identityStatus:"ACTIVE",activeGrantIds:["a"]}),/MOVER_REQUIRES_GRANTS/));
test("mover rejects grants outside identity active grants",()=>assert.throws(()=>planLifecycleTransition({type:"MOVER",identityStatus:"ACTIVE",activeGrantIds:["a"],selectedGrantIds:["foreign"]}),/GRANT_NOT_ACTIVE_FOR_IDENTITY/));
test("leaver disables identity and revokes all active grants",()=>assert.deepEqual(planLifecycleTransition({type:"LEAVER",identityStatus:"ACTIVE",activeGrantIds:["a","b"]}),{identityStatus:"DISABLED",revokeGrantIds:["a","b"]}));
test("leaver cannot be repeated for disabled identity",()=>assert.throws(()=>planLifecycleTransition({type:"LEAVER",identityStatus:"DISABLED",activeGrantIds:[]}),/IDENTITY_ALREADY_DISABLED/));
test("non-mover event cannot carry grant selections",()=>assert.throws(()=>planLifecycleTransition({type:"JOINER",identityStatus:"PENDING",activeGrantIds:[],selectedGrantIds:["a"]}),/GRANTS_ONLY_FOR_MOVER/));

test("lifecycle requester cannot approve their own request",async()=>{
 const {isIndependentApprover}=await import("../apps/web/lib/lifecycle-policy.mjs");
 assert.equal(isIndependentApprover({requesterUserId:"user-a",approverUserId:"user-a"}),false);
});
test("a different authorized reviewer can approve a lifecycle request",async()=>{
 const {isIndependentApprover}=await import("../apps/web/lib/lifecycle-policy.mjs");
 assert.equal(isIndependentApprover({requesterUserId:"user-a",approverUserId:"user-b"}),true);
});
