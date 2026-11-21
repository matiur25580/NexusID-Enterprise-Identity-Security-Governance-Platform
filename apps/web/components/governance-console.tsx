"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, KeyRound, Layers3, Plus, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import {
  createApplication, createEntitlement, submitAccessRequest, decideAccessRequest, revokeAccessGrant,
  type GovernanceActionState,
} from "@/app/governance/actions";

type AppItem = {
  id: string; name: string; slug: string; description: string | null; ownerTeam: string | null;
  entitlements: { id: string; key: string; name: string; description: string | null; riskLevel: string; privileged: boolean }[];
};
type IdentityItem = { id: string; displayName: string; email: string | null; type: string };
type RequestItem = {
  id: string; status: string; requestReason: string; decisionReason: string | null; createdAt: string; decidedAt: string | null;
  identityName: string; identityEmail: string | null; entitlementName: string; entitlementKey: string;
  applicationName: string; requesterName: string; decisionName: string | null; requesterUserId: string;
};
type GrantItem = {
  id: string; status: string; grantedAt: string; revokedAt: string | null; identityName: string; identityEmail: string | null;
  entitlementName: string; entitlementKey: string; applicationName: string;
};
const emptyState: GovernanceActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}><Plus size={14} />{pending ? "Saving…" : label}</button>;
}
function FormFeedback({ state }: { state: GovernanceActionState }) {
  return <>{state.error && <p className="governance-error" role="alert">{state.error}</p>}{state.success && <p className="governance-success" role="status">{state.success}</p>}</>;
}
function ApplicationForm() {
  const [state, action] = useActionState(createApplication, emptyState);
  return <form action={action} className="governance-form">
    <label>Application name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Production AWS" /></label>
    <label>Owner team<input name="ownerTeam" maxLength={100} placeholder="Platform Engineering" /></label>
    <label className="governance-wide">Description<textarea name="description" maxLength={1000} rows={2} placeholder="What this application is used for" /></label>
    <FormFeedback state={state} /><div className="governance-form-submit"><Submit label="Add application" /></div>
  </form>;
}
function EntitlementForm({ applications }: { applications: AppItem[] }) {
  const [state, action] = useActionState(createEntitlement, emptyState);
  return <form action={action} className="governance-form">
    <label>Application<select name="applicationId" required defaultValue=""><option value="" disabled>Select application</option>{applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
    <label>Entitlement key<input name="key" required minLength={2} maxLength={100} pattern="[A-Za-z0-9._:-]+" placeholder="aws.prod.admin" /></label>
    <label>Display name<input name="name" required minLength={2} maxLength={120} placeholder="Production administrator" /></label>
    <label>Risk level<select name="riskLevel" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>
    <label>Privileged access<select name="privileged" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label>
    <label className="governance-wide">Description<textarea name="description" maxLength={1000} rows={2} placeholder="What this permission allows" /></label>
    <FormFeedback state={state} /><div className="governance-form-submit"><Submit label="Add entitlement" /></div>
  </form>;
}
function AccessRequestForm({ applications, identities }: { applications: AppItem[]; identities: IdentityItem[] }) {
  const [state, action] = useActionState(submitAccessRequest, emptyState);
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const entitlements = applications.find((app) => app.id === applicationId)?.entitlements ?? [];
  return <form action={action} className="governance-form">
    <label>Identity<select name="identityId" required defaultValue=""><option value="" disabled>Select active identity</option>{identities.map((identity) => <option key={identity.id} value={identity.id}>{identity.displayName}{identity.email ? " · " + identity.email : ""}</option>)}</select></label>
    <label>Application<select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>{applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
    <label className="governance-wide">Entitlement<select name="entitlementId" required defaultValue=""><option value="" disabled>Select entitlement</option>{entitlements.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.riskLevel}{item.privileged ? " · Privileged" : ""}</option>)}</select></label>
    <label className="governance-wide">Business justification<textarea name="requestReason" required minLength={10} maxLength={1500} rows={3} placeholder="Explain the business need, scope and expected duration…" /></label>
    <FormFeedback state={state} /><div className="governance-form-submit"><Submit label="Submit for approval" /></div>
  </form>;
}

export default function GovernanceConsole({ organizationName, role, applications, identities, requests, grants, currentUserId }: {
  organizationName: string; role: string; applications: AppItem[]; identities: IdentityItem[];
  requests: RequestItem[]; grants: GrantItem[]; currentUserId: string;
}) {
  const [tab, setTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showEntitlementForm, setShowEntitlementForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const canManage = ["OWNER", "ADMIN", "SECURITY_ANALYST"].includes(role);
  const filteredRequests = useMemo(() => requests.filter((request) =>
    [request.identityName, request.identityEmail, request.entitlementName, request.entitlementKey, request.applicationName, request.requesterName].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  ), [requests, search]);
  const activeGrants = grants.filter((grant) => grant.status === "ACTIVE");
  const pendingRequests = requests.filter((request) => request.status === "PENDING");

  return <main className="governance-shell">
    <header className="governance-topbar"><a href="/" className="directory-back"><ArrowLeft size={15} /> Command center</a><div className="directory-workspace"><span>{organizationName}</span><span className="directory-role">{role.replaceAll("_", " ")}</span></div></header>
    <div className="governance-content">
      <div className="directory-heading"><div><div className="eyebrow"><span /> ACCESS GOVERNANCE</div><h1>Entitlements & access</h1><p>Catalog permissions, request access and enforce approval with an auditable grant trail.</p></div>{role !== "AUDITOR" && <button className="primary-button" onClick={() => setShowRequestForm((v) => !v)}><Plus size={15} /> Request access</button>}</div>
      <div className="governance-stats">
        <article><span><Layers3 size={17} /></span><div><small>Applications</small><strong>{applications.length}</strong></div></article>
        <article><span><KeyRound size={17} /></span><div><small>Entitlements</small><strong>{applications.reduce((sum, app) => sum + app.entitlements.length, 0)}</strong></div></article>
        <article><span><ShieldAlert size={17} /></span><div><small>Pending requests</small><strong>{pendingRequests.length}</strong></div></article>
        <article><span><ShieldCheck size={17} /></span><div><small>Active grants</small><strong>{activeGrants.length}</strong></div></article>
      </div>

      {showRequestForm && <section className="governance-panel"><div className="governance-panel-heading"><div><h2>Request access</h2><p>Requests are reviewed by an authorized workspace operator.</p></div><button className="directory-close" onClick={() => setShowRequestForm(false)} aria-label="Close">×</button></div><AccessRequestForm applications={applications} identities={identities} /></section>}

      <div className="governance-tabs" role="tablist" aria-label="Governance views">
        <button className={tab === "requests" ? "selected" : ""} onClick={() => setTab("requests")}>Access requests <span>{pendingRequests.length}</span></button>
        <button className={tab === "catalog" ? "selected" : ""} onClick={() => setTab("catalog")}>Entitlement catalog</button>
        <button className={tab === "grants" ? "selected" : ""} onClick={() => setTab("grants")}>Access grants</button>
      </div>

      {tab === "requests" && <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Access requests</h2><p>Pending decisions and recent request history</p></div><span className="directory-result-count">{filteredRequests.length} records</span></div>
        <label className="governance-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search identity, application or entitlement…" /></label>
        <div className="governance-list">
          {filteredRequests.map((request) => <article className="governance-record" key={request.id}>
            <div className="governance-record-main"><div><strong>{request.entitlementName}</strong><span>{request.applicationName} · {request.entitlementKey}</span></div><span className={"governance-status " + request.status.toLowerCase()}>{request.status.toLowerCase()}</span></div>
            <div className="governance-record-meta"><span><Users size={13} /> {request.identityName}{request.identityEmail ? " · " + request.identityEmail : ""}</span><span>Requested by {request.requesterName}</span><span>{new Date(request.createdAt).toLocaleDateString()}</span></div>
            <p className="governance-reason">{request.requestReason}</p>
            {request.status === "PENDING" && canManage && request.requesterUserId !== currentUserId && <form action={decideAccessRequest} className="governance-decision">
              <input type="hidden" name="requestId" value={request.id} />
              <input name="decisionReason" required minLength={5} maxLength={1000} placeholder="Decision rationale (required)" />
              <button name="decision" value="APPROVED" className="approve-button" type="submit"><CheckCircle2 size={13} /> Approve</button>
              <button name="decision" value="REJECTED" className="reject-button" type="submit">Reject</button>
            </form>}
            {request.status === "PENDING" && request.requesterUserId === currentUserId && <p className="governance-hint">You cannot approve your own request.</p>}
            {request.decisionReason && <p className="governance-decision-note">Decision: {request.decisionReason}{request.decisionName ? " · " + request.decisionName : ""}</p>}
          </article>)}
          {filteredRequests.length === 0 && <p className="governance-empty">No access requests found.</p>}
        </div>
      </section>}

      {tab === "catalog" && <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Application & entitlement catalog</h2><p>Access definitions owned by your organization</p></div>{canManage && <div className="governance-inline-actions"><button className="secondary-button" onClick={() => setShowApplicationForm((v) => !v)}>Add application</button><button className="primary-button" onClick={() => setShowEntitlementForm((v) => !v)}><Plus size={14} /> Add entitlement</button></div>}</div>
        {showApplicationForm && <div className="governance-form-block"><h3>Register application</h3><ApplicationForm /></div>}
        {showEntitlementForm && <div className="governance-form-block"><h3>Create entitlement</h3>{applications.length ? <EntitlementForm applications={applications} /> : <p className="governance-hint">Create an application before adding entitlements.</p>}</div>}
        <div className="catalog-list">{applications.map((app) => <article className="catalog-application" key={app.id}>
          <div className="catalog-app-heading"><div><strong>{app.name}</strong><span>{app.ownerTeam || "No owner team"} · {app.slug}</span></div><span>{app.entitlements.length} entitlements</span></div>
          {app.description && <p>{app.description}</p>}
          {app.entitlements.map((item) => <div className="catalog-entitlement" key={item.id}><div><strong>{item.name}</strong><span>{item.key}{item.description ? " · " + item.description : ""}</span></div><div className="catalog-entitlement-tags"><span className={"risk-tag " + item.riskLevel.toLowerCase()}>{item.riskLevel}</span>{item.privileged && <span className="privileged-tag">Privileged</span>}</div></div>)}
          {app.entitlements.length === 0 && <p className="governance-empty">No entitlements registered for this application.</p>}
        </article>)}
        {applications.length === 0 && <p className="governance-empty">No applications yet. Add your first application to start the catalog.</p>}</div>
      </section>}

      {tab === "grants" && <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Access grants</h2><p>Current and revoked entitlement assignments</p></div><span className="directory-result-count">{grants.length} records</span></div>
        <div className="governance-list">
          {grants.map((grant) => <article className="governance-grant" key={grant.id}><div><strong>{grant.identityName}</strong><span>{grant.applicationName} · {grant.entitlementName} ({grant.entitlementKey})</span></div><span className={"governance-status " + grant.status.toLowerCase()}>{grant.status.toLowerCase()}</span><small>{grant.status === "ACTIVE" ? "Granted " : "Revoked "}{new Date(grant.status === "ACTIVE" ? grant.grantedAt : grant.revokedAt || grant.grantedAt).toLocaleDateString()}</small>{canManage && grant.status === "ACTIVE" && <form action={revokeAccessGrant}><input type="hidden" name="grantId" value={grant.id} /><button className="reject-button" type="submit">Revoke access</button></form>}</article>)}
          {grants.length === 0 && <p className="governance-empty">No access grants yet. Approving an access request creates the first grant.</p>}
        </div>
      </section>}
      <footer className="page-footer"><span>© 2026 NexusID · Access governance</span><a href="/identities">Open identity directory</a></footer>
    </div>
  </main>;
}
