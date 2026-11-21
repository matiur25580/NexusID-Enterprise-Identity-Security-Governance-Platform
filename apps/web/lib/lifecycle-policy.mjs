export function planLifecycleTransition({type,identityStatus,activeGrantIds,selectedGrantIds=[]}) {
 if(type==="JOINER"&&identityStatus!=="PENDING")throw new Error("JOINER_REQUIRES_PENDING");
 if(type==="LEAVER"&&identityStatus==="DISABLED")throw new Error("IDENTITY_ALREADY_DISABLED");
 if(type==="MOVER"&&!selectedGrantIds.length)throw new Error("MOVER_REQUIRES_GRANTS");
 if(type!=="MOVER"&&selectedGrantIds.length)throw new Error("GRANTS_ONLY_FOR_MOVER");
 if(selectedGrantIds.some(id=>!activeGrantIds.includes(id)))throw new Error("GRANT_NOT_ACTIVE_FOR_IDENTITY");
 return type==="JOINER"?{identityStatus:"ACTIVE",revokeGrantIds:[]}:type==="LEAVER"?{identityStatus:"DISABLED",revokeGrantIds:[...activeGrantIds]}:{identityStatus,revokeGrantIds:[...selectedGrantIds]};
}

/** Enforce maker-checker separation for lifecycle approvals. */
export function isIndependentApprover({requesterUserId,approverUserId}) {
 return Boolean(requesterUserId && approverUserId && requesterUserId !== approverUserId);
}
