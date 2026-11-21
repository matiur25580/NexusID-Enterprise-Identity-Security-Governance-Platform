"use client";

import { useActionState } from "react";
import { ArrowLeft, Ban, CheckCircle2, CircleAlert, FlaskConical, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { simulateAccessPolicy, type PolicySimulationState } from "@/app/policies/actions";

type Identity = { id: string; displayName: string; email: string | null; type: string; status: string };
type Entitlement = { id: string; name: string; key: string; riskLevel: string; privileged: boolean; enabled: boolean; applicationName: string };
const initial: PolicySimulationState = {};

const policyRules = [
  { code: "IDENTITY_NOT_ACTIVE", title: "Active identity required", impact: "DENY", detail: "Suspended, disabled and pending identities cannot receive access." },
  { code: "ENTITLEMENT_DISABLED", title: "Enabled entitlement required", impact: "DENY", detail: "Disabled catalog entries cannot be requested or granted." },
  { code: "DUPLICATE_ACTIVE_GRANT", title: "No duplicate active grants", impact: "DENY", detail: "An identity cannot request an entitlement it already holds." },
  { code: "PENDING_REQUEST_EXISTS", title: "No duplicate pending requests", impact: "DENY", detail: "A second pending request for the same identity and entitlement is blocked." },
  { code: "CRITICAL_ENTITLEMENT", title: "Critical-risk access", impact: "REVIEW", detail: "Critical entitlements require explicit security review." },
  { code: "HIGH_RISK_ENTITLEMENT", title: "High-risk access", impact: "REVIEW", detail: "High-risk entitlements require documented human approval." },
  { code: "PRIVILEGED_ACCESS", title: "Privileged permissions", impact: "REVIEW", detail: "Privileged access requires an explicit reviewer decision and rationale." },
  { code: "NON_HUMAN_IDENTITY", title: "Non-human identity access", impact: "REVIEW", detail: "Service, workload and AI-agent access requires owner and purpose validation." },
];

function SimulationForm({ identities, entitlements }: { identities: Identity[]; entitlements: Entitlement[] }) {
  const [state, action, pending] = useActionState(simulateAccessPolicy, initial);
  return <form action={action} className="policy-sim-form">
    <label>Identity<select name="identityId" required defaultValue=""><option value="" disabled>Select an identity</option>{identities.map((identity) => <option key={identity.id} value={identity.id}>{identity.displayName} · {identity.type.replaceAll("_"," ")} · {identity.status}</option>)}</select></label>
    <label>Entitlement<select name="entitlementId" required defaultValue=""><option value="" disabled>Select an entitlement</option>{entitlements.map((item) => <option key={item.id} value={item.id}>{item.applicationName} · {item.name} ({item.riskLevel}{item.privileged ? ", privileged" : ""}{item.enabled ? "" : ", disabled"})</option>)}</select></label>
    <button className="primary-button" type="submit" disabled={pending || !identities.length || !entitlements.length}><FlaskConical size={14}/>{pending ? "Evaluating…" : "Evaluate access"}</button>
    {state.error && <p className="policy-error">{state.error}</p>}
    {state.result && <div className="policy-result">
      <div className="policy-result-heading"><span className={"policy-outcome " + state.result.outcome.toLowerCase()}>{state.result.outcome === "DENY" ? <Ban size={17}/> : state.result.outcome === "REVIEW" ? <ShieldAlert size={17}/> : <CheckCircle2 size={17}/>} {state.result.outcome}</span><strong>{state.result.summary}</strong></div>
      {state.result.rules.length ? <div className="policy-result-rules">{state.result.rules.map((rule) => <div key={rule.code} className={"policy-hit " + rule.outcome.toLowerCase()}><span>{rule.outcome === "DENY" ? <Ban size={14}/> : <CircleAlert size={14}/>}</span><div><strong>{rule.title}</strong><p>{rule.explanation}</p><small>{rule.code}</small></div></div>)}</div> : <p className="policy-no-hits"><CheckCircle2 size={14}/> No additional policy rule matched this request.</p>}
    </div>}
  </form>;
}

export default function PolicyStudio({ organizationName, identities, entitlements }: { organizationName: string; identities: Identity[]; entitlements: Entitlement[] }) {
  const denyCount = policyRules.filter((rule) => rule.impact === "DENY").length;
  const reviewCount = policyRules.filter((rule) => rule.impact === "REVIEW").length;
  return <main className="cert-shell">
    <header className="governance-topbar"><a href="/governance" className="directory-back"><ArrowLeft size={15}/> Access governance</a><div className="directory-workspace"><span>{organizationName}</span><span className="directory-role">POLICY STUDIO</span></div></header>
    <div className="governance-content">
      <div className="directory-heading"><div><div className="eyebrow"><span/> ZERO-TRUST POLICY CONTROLS</div><h1>Policy evaluation</h1><p>Explainable, deterministic checks for access requests and approval decisions.</p></div></div>
      <div className="governance-stats cert-stats">
        <article><span><ShieldCheck size={17}/></span><div><small>Active baseline rules</small><strong>{policyRules.length}</strong></div></article>
        <article><span><Ban size={17}/></span><div><small>Hard deny controls</small><strong>{denyCount}</strong></div></article>
        <article><span><LockKeyhole size={17}/></span><div><small>Human review controls</small><strong>{reviewCount}</strong></div></article>
        <article><span><FlaskConical size={17}/></span><div><small>Catalog coverage</small><strong>{entitlements.length}</strong></div></article>
      </div>
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Run a policy simulation</h2><p>Evaluate an identity and entitlement pair using the same engine as access governance.</p></div></div>
        {identities.length && entitlements.length ? <SimulationForm identities={identities} entitlements={entitlements}/> : <p className="governance-empty">Add identities and entitlements before running a simulation.</p>}
      </section>
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Baseline policy library</h2><p>Rules execute server-side in deterministic priority order: DENY before REVIEW before ALLOW.</p></div><span className="directory-result-count">{policyRules.length} rules</span></div>
        <div className="policy-rule-list">{policyRules.map((rule) => <article className="policy-rule" key={rule.code}><span className={"policy-rule-icon " + rule.impact.toLowerCase()}>{rule.impact === "DENY" ? <Ban size={15}/> : <CircleAlert size={15}/>}</span><div><div className="policy-rule-title"><strong>{rule.title}</strong><span className={"governance-status " + rule.impact.toLowerCase()}>{rule.impact}</span></div><p>{rule.detail}</p><small>{rule.code}</small></div></article>)}</div>
      </section>
      <p className="policy-disclaimer">Baseline policy engine · Simulation results are advisory. All non-denied access requests still require an authorized human approval. No external application is provisioned by this evaluation.</p>
      <footer className="page-footer"><span>© 2026 NexusID · Explainable policy controls</span><a href="/certifications">Access certifications</a></footer>
    </div>
  </main>;
}
