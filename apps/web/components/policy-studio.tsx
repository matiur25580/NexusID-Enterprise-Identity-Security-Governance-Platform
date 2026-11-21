"use client";

import { useActionState } from "react";
import { ArrowLeft, Ban, CheckCircle2, CircleAlert, FlaskConical, LockKeyhole, ShieldAlert, ShieldCheck, Plus, History, Power } from "lucide-react";
import {
  createPolicyRule, updatePolicyRule, setPolicyRuleEnabled, simulateAccessPolicy,
  type PolicyActionState, type PolicySimulationState,
} from "@/app/policies/actions";

type Identity = { id: string; displayName: string; email: string | null; type: string; status: string };
type Entitlement = { id: string; name: string; key: string; riskLevel: string; privileged: boolean; enabled: boolean; applicationName: string };
type Version = { version: number; changeNote: string | null; createdAt: string; actor: string | null };
type Policy = { id: string; key: string; name: string; description: string | null; effect: string; field: string; operator: string; value: string; priority: number; enabled: boolean; version: number; lastSimulatedAt: string | null; validatedVersion: number | null; updatedAt: string; versions: Version[] };
const initialSimulation: PolicySimulationState = {};
const initialAction: PolicyActionState = {};
const fields = [
  ["IDENTITY_STATUS", "Identity status"], ["IDENTITY_TYPE", "Identity type"],
  ["IDENTITY_EMAIL_DOMAIN", "Email domain"], ["ENTITLEMENT_RISK", "Entitlement risk"],
  ["ENTITLEMENT_PRIVILEGED", "Privileged entitlement"],
];

function PolicyFields({ policy }: { policy?: Policy }) {
  return <>
    <label>Rule key<input name="key" required minLength={2} maxLength={40} pattern="[A-Za-z][A-Za-z0-9_-]*" defaultValue={policy?.key ?? ""} placeholder="e.g. FINANCE_HIGH_RISK" /></label>
    <label>Policy name<input name="name" required minLength={3} maxLength={100} defaultValue={policy?.name ?? ""} placeholder="Require finance review" /></label>
    <label className="policy-form-wide">Description<input name="description" maxLength={500} defaultValue={policy?.description ?? ""} placeholder="Explain why this rule exists" /></label>
    <label>Effect<select name="effect" defaultValue={policy?.effect ?? "REVIEW"}><option value="DENY">DENY</option><option value="REVIEW">REVIEW</option><option value="ALLOW">ALLOW</option></select></label>
    <label>Condition field<select name="field" defaultValue={policy?.field ?? "ENTITLEMENT_RISK"}>{fields.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Operator<select name="operator" defaultValue={policy?.operator ?? "EQ"}><option value="EQ">Equals</option><option value="NEQ">Does not equal</option><option value="IN">Is one of (comma separated)</option></select></label>
    <label>Expected value<input name="value" required maxLength={200} defaultValue={policy?.value ?? "HIGH"} placeholder="HIGH,CRITICAL" /></label>
    <label>Priority (lower runs first)<input name="priority" type="number" min="1" max="10000" required defaultValue={policy?.priority ?? 100} /></label>
  </>;
}

function SimulationForm({ identities, entitlements }: { identities: Identity[]; entitlements: Entitlement[] }) {
  const [state, action, pending] = useActionState(simulateAccessPolicy, initialSimulation);
  return <form action={action} className="policy-sim-form">
    <label>Identity<select name="identityId" required defaultValue=""><option value="" disabled>Select an identity</option>{identities.map((identity) => <option key={identity.id} value={identity.id}>{identity.displayName} · {identity.type.replaceAll("_"," ")} · {identity.status}</option>)}</select></label>
    <label>Entitlement<select name="entitlementId" required defaultValue=""><option value="" disabled>Select an entitlement</option>{entitlements.map((item) => <option key={item.id} value={item.id}>{item.applicationName} · {item.name} ({item.riskLevel}{item.privileged ? ", privileged" : ""}{item.enabled ? "" : ", disabled"})</option>)}</select></label>
    <button className="primary-button" type="submit" disabled={pending || !identities.length || !entitlements.length}><FlaskConical size={14}/>{pending ? "Evaluating…" : "Evaluate policies"}</button>
    {state.error && <p className="policy-error">{state.error}</p>}
    {state.result && <div className="policy-result">
      <div className="policy-result-heading"><span className={"policy-outcome " + state.result.outcome.toLowerCase()}>{state.result.outcome === "DENY" ? <Ban size={17}/> : state.result.outcome === "REVIEW" ? <ShieldAlert size={17}/> : <CheckCircle2 size={17}/>} {state.result.outcome}</span><strong>{state.result.summary}</strong></div>
      {state.result.rules.length ? <div className="policy-result-rules">{state.result.rules.map((rule) => <div key={rule.code} className={"policy-hit " + rule.outcome.toLowerCase()}><span>{rule.outcome === "DENY" ? <Ban size={14}/> : <CircleAlert size={14}/>}</span><div><strong>{rule.title}</strong><p>{rule.explanation}</p><small>{rule.source ?? "BASELINE"} · {rule.code}</small></div></div>)}</div> : <p className="policy-no-hits"><CheckCircle2 size={14}/> No additional policy rule matched this request.</p>}
      <p className="policy-validation-note">This simulation evaluated the current draft and active rule set for the selected identity/entitlement pair. It records a test timestamp; it is not exhaustive coverage of every possible access context.</p>
    </div>}
  </form>;
}

function CreatePolicyForm() {
  const [state, action, pending] = useActionState(createPolicyRule, initialAction);
  return <form action={action} className="policy-author-form">
    <PolicyFields />
    <div className="policy-form-wide policy-form-actions"><button className="primary-button" disabled={pending}><Plus size={14}/>{pending ? "Creating…" : "Create draft policy"}</button>{state.error && <p className="policy-error">{state.error}</p>}{state.success && <p className="policy-success">{state.success}</p>}</div>
  </form>;
}

function EditPolicyForm({ policy }: { policy: Policy }) {
  const [state, action, pending] = useActionState(updatePolicyRule, initialAction);
  return <form action={action} className="policy-author-form policy-edit-form">
    <input type="hidden" name="ruleId" value={policy.id}/>
    <PolicyFields policy={policy}/>
    <label className="policy-form-wide">Change note<input name="changeNote" required minLength={5} maxLength={300} placeholder="Why is this policy changing?" /></label>
    <div className="policy-form-wide policy-form-actions"><button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save new version"}</button>{state.error && <p className="policy-error">{state.error}</p>}{state.success && <p className="policy-success">{state.success}</p>}</div>
  </form>;
}

function PolicyCard({ policy, canManage }: { policy: Policy; canManage: boolean }) {
  const simulated = policy.validatedVersion === policy.version;
  return <article className="policy-managed-card">
    <div className="policy-managed-heading">
      <span className={"policy-rule-icon " + policy.effect.toLowerCase()}>{policy.effect === "DENY" ? <Ban size={15}/> : policy.effect === "REVIEW" ? <CircleAlert size={15}/> : <CheckCircle2 size={15}/>}</span>
      <div className="policy-managed-main"><div className="policy-rule-title"><strong>{policy.name}</strong><span className={"governance-status " + policy.effect.toLowerCase()}>{policy.effect}</span><span className={"policy-state " + (policy.enabled ? "enabled" : "draft")}>{policy.enabled ? "ACTIVE" : "DRAFT"}</span></div><p>{policy.description || "No description provided."}</p><small>{policy.key} · {policy.field} {policy.operator} {policy.value} · Priority {policy.priority} · v{policy.version}</small></div>
    </div>
    <div className="policy-managed-actions">
      {canManage && <form action={setPolicyRuleEnabled}><input type="hidden" name="ruleId" value={policy.id}/><input type="hidden" name="enabled" value={String(!policy.enabled)}/><button className="policy-text-button" type="submit"><Power size={13}/>{policy.enabled ? "Disable" : simulated ? "Enable" : "Simulate before enabling"}</button></form>}
      {!policy.enabled && canManage && <details className="policy-edit-details"><summary>Edit draft</summary><EditPolicyForm policy={policy}/></details>}
      <details className="policy-history"><summary><History size={13}/> Version history ({policy.versions.length})</summary><div className="policy-version-list">{policy.versions.map((version) => <div key={version.version}><strong>v{version.version}</strong><span>{version.changeNote || "Policy saved"}</span><small>{version.actor || "Former member"} · {new Date(version.createdAt).toLocaleString()}</small></div>)}</div></details>
    </div>
    {!policy.enabled && <p className="policy-draft-hint">{simulated ? "Simulation run after last edit. Review the result before activation." : "Draft is not enforced. Run a simulation after the latest edit before activation."}</p>}
  </article>;
}

const baselineRules = [
  { code: "IDENTITY_NOT_ACTIVE", title: "Active identity required", impact: "DENY", detail: "Suspended, disabled and pending identities cannot receive access." },
  { code: "ENTITLEMENT_DISABLED", title: "Enabled entitlement required", impact: "DENY", detail: "Disabled catalog entries cannot be requested or granted." },
  { code: "DUPLICATE_ACTIVE_GRANT", title: "No duplicate active grants", impact: "DENY", detail: "An identity cannot request an entitlement it already holds." },
  { code: "PENDING_REQUEST_EXISTS", title: "No duplicate pending requests", impact: "DENY", detail: "A second pending request for the same identity and entitlement is blocked." },
  { code: "CRITICAL_ENTITLEMENT", title: "Critical-risk access", impact: "REVIEW", detail: "Critical entitlements require explicit security review." },
  { code: "HIGH_RISK_ENTITLEMENT", title: "High-risk access", impact: "REVIEW", detail: "High-risk entitlements require documented human approval." },
  { code: "PRIVILEGED_ACCESS", title: "Privileged permissions", impact: "REVIEW", detail: "Privileged access requires an explicit reviewer decision and rationale." },
  { code: "NON_HUMAN_IDENTITY", title: "Non-human identity access", impact: "REVIEW", detail: "Service, workload and AI-agent access requires owner and purpose validation." },
];

export default function PolicyStudio({ organizationName, identities, entitlements, policies, canManage }: {
  organizationName: string; identities: Identity[]; entitlements: Entitlement[]; policies: Policy[]; canManage: boolean;
}) {
  const denyCount = baselineRules.filter((rule) => rule.impact === "DENY").length;
  const reviewCount = baselineRules.filter((rule) => rule.impact === "REVIEW").length;
  return <main className="cert-shell">
    <header className="governance-topbar"><a href="/governance" className="directory-back"><ArrowLeft size={15}/> Access governance</a><div className="directory-workspace"><span>{organizationName}</span><span className="directory-role">POLICY STUDIO</span></div></header>
    <div className="governance-content">
      <div className="directory-heading"><div><div className="eyebrow"><span/> ZERO-TRUST POLICY CONTROLS</div><h1>Policy evaluation</h1><p>Governed policy authoring, explainable decisions and versioned controls.</p></div></div>
      <div className="governance-stats cert-stats">
        <article><span><ShieldCheck size={17}/></span><div><small>Immutable baseline rules</small><strong>{baselineRules.length}</strong></div></article>
        <article><span><Ban size={17}/></span><div><small>Baseline deny controls</small><strong>{denyCount}</strong></div></article>
        <article><span><LockKeyhole size={17}/></span><div><small>Baseline review controls</small><strong>{reviewCount}</strong></div></article>
        <article><span><FlaskConical size={17}/></span><div><small>Custom policies</small><strong>{policies.length}</strong></div></article>
      </div>
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Policy simulation</h2><p>Test baseline and custom draft rules against the same evaluator used by access requests.</p></div></div>
        {identities.length && entitlements.length ? <SimulationForm identities={identities} entitlements={entitlements}/> : <p className="governance-empty">Add identities and entitlements before running a simulation.</p>}
      </section>
      {canManage && <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Create configurable policy</h2><p>New rules start disabled. Supported conditions are intentionally allow-listed; no executable expressions or arbitrary code.</p></div></div>
        <CreatePolicyForm/>
      </section>}
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Workspace policy library</h2><p>Tenant-scoped rules. Lower priority numbers run first; DENY always takes precedence over REVIEW and ALLOW.</p></div><span className="directory-result-count">{policies.length} policies</span></div>
        {policies.length ? <div className="policy-managed-list">{policies.map((policy) => <PolicyCard key={policy.id} policy={policy} canManage={canManage}/>)}</div> : <p className="governance-empty">No custom policies yet. Create a draft to extend the baseline controls.</p>}
      </section>
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Immutable baseline policy library</h2><p>These mandatory safety controls cannot be edited or disabled by workspace administrators.</p></div><span className="directory-result-count">{baselineRules.length} rules</span></div>
        <div className="policy-rule-list">{baselineRules.map((rule) => <article className="policy-rule" key={rule.code}><span className={"policy-rule-icon " + rule.impact.toLowerCase()}>{rule.impact === "DENY" ? <Ban size={15}/> : <CircleAlert size={15}/>}</span><div><div className="policy-rule-title"><strong>{rule.title}</strong><span className={"governance-status " + rule.impact.toLowerCase()}>{rule.impact}</span></div><p>{rule.detail}</p><small>{rule.code}</small></div></article>)}</div>
      </section>
      <p className="policy-disclaimer">Custom policy enforcement applies to new access requests and approval-time re-evaluation. Existing grants are not continuously re-evaluated and no external application is provisioned. Simulation is a scenario test, not exhaustive policy verification.</p>
      <footer className="page-footer"><span>© 2026 NexusID · Explainable policy controls</span><a href="/certifications">Access certifications</a></footer>
    </div>
  </main>;
}
