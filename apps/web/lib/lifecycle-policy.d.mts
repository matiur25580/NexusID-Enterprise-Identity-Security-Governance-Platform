export function planLifecycleTransition(input:{type:"JOINER"|"MOVER"|"LEAVER";identityStatus:string;activeGrantIds:string[];selectedGrantIds?:string[]}):{identityStatus:string;revokeGrantIds:string[]};
export function isIndependentApprover(input:{requesterUserId:string|null|undefined;approverUserId:string|null|undefined}):boolean;
