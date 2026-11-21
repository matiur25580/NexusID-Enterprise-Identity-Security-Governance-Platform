"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ChevronDown, CircleAlert, Fingerprint, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { createIdentity, updateIdentityStatus, type IdentityActionState } from "@/app/identities/actions";

type Identity = {
  id: string;
  displayName: string;
  email: string | null;
  type: "HUMAN" | "SERVICE" | "WORKLOAD" | "AI_AGENT";
  status: "ACTIVE" | "SUSPENDED" | "DISABLED" | "PENDING";
  source: string | null;
  externalId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const initialState: IdentityActionState = {};
const typeLabels: Record<Identity["type"], string> = {
  HUMAN: "Human",
  SERVICE: "Service",
  WORKLOAD: "Workload",
  AI_AGENT: "AI agent",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}><Plus size={15} />{pending ? "Adding…" : "Add identity"}</button>;
}

function CreateIdentityForm({ onClose }: { onClose: () => void }) {
  const [state, action] = useActionState(createIdentity, initialState);
  return (
    <form action={async (formData) => { const result = await action(formData); if (!result?.error) onClose(); }} className="identity-form">
      <div className="identity-form-grid">
        <label>Display name<input name="displayName" required minLength={2} maxLength={120} placeholder="e.g. Aisha Rahman" /></label>
        <label>Email address<input name="email" type="email" maxLength={254} placeholder="aisha@company.com" /></label>
        <label>Identity type<select name="type" defaultValue="HUMAN"><option value="HUMAN">Human</option><option value="SERVICE">Service account</option><option value="WORKLOAD">Workload</option><option value="AI_AGENT">AI agent</option></select></label>
        <label>External ID<input name="externalId" maxLength={160} placeholder="Optional source identifier" /></label>
        <label>Source<input name="source" maxLength={80} defaultValue="Manual" placeholder="Manual, Okta, Entra ID…" /></label>
      </div>
      {state?.error && <p className="identity-form-error" role="alert">{state.error}</p>}
      {state?.success && <p className="identity-form-success" role="status">{state.success}</p>}
      <div className="identity-form-actions"><button type="button" className="identity-cancel" onClick={onClose}>Cancel</button><SubmitButton /></div>
    </form>
  );
}

export default function IdentityDirectory({ organizationName, role, initialIdentities }: {
  organizationName: string;
  role: string;
  initialIdentities: Identity[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const canManage = ["OWNER", "ADMIN", "SECURITY_ANALYST"].includes(role);

  const filtered = useMemo(() => initialIdentities.filter((identity) => {
    const haystack = [identity.displayName, identity.email, identity.externalId, identity.source].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase()) &&
      (typeFilter === "ALL" || identity.type === typeFilter) &&
      (statusFilter === "ALL" || identity.status === statusFilter);
  }), [initialIdentities, query, typeFilter, statusFilter]);

  const counts = {
    total: initialIdentities.length,
    human: initialIdentities.filter((item) => item.type === "HUMAN").length,
    nonHuman: initialIdentities.filter((item) => item.type !== "HUMAN").length,
    attention: initialIdentities.filter((item) => item.status === "PENDING" || item.status === "SUSPENDED").length,
  };

  return (
    <main className="directory-shell">
      <header className="directory-topbar">
        <a href="/" className="directory-back"><ArrowLeft size={15} /> Command center</a>
        <div className="directory-workspace"><span>{organizationName}</span><span className="directory-role">{role.replaceAll("_", " ")}</span></div>
      </header>
      <div className="directory-content">
        <div className="directory-heading">
          <div><div className="eyebrow"><span /> IDENTITY GOVERNANCE</div><h1>Identity directory</h1><p>Discover and manage workforce, service, workload and AI-agent identities.</p></div>
          {canManage && <button className="primary-button" onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> Add identity</button>}
        </div>

        <div className="directory-stats">
          <article><span className="directory-stat-icon"><Users size={17} /></span><div><small>Total identities</small><strong>{counts.total.toLocaleString()}</strong></div></article>
          <article><span className="directory-stat-icon"><Fingerprint size={17} /></span><div><small>Human identities</small><strong>{counts.human.toLocaleString()}</strong></div></article>
          <article><span className="directory-stat-icon"><ShieldCheck size={17} /></span><div><small>Non-human identities</small><strong>{counts.nonHuman.toLocaleString()}</strong></div></article>
          <article><span className="directory-stat-icon attention"><CircleAlert size={17} /></span><div><small>Needs attention</small><strong>{counts.attention.toLocaleString()}</strong></div></article>
        </div>

        {showCreate && <section className="directory-panel"><div className="directory-panel-heading"><div><h2>Add an identity</h2><p>New records start in Pending status until reviewed.</p></div><button className="directory-close" onClick={() => setShowCreate(false)} aria-label="Close">×</button></div><CreateIdentityForm onClose={() => setShowCreate(false)} /></section>}

        <section className="directory-panel">
          <div className="directory-panel-heading"><div><h2>All identities</h2><p>Showing up to 250 most recently updated records</p></div><span className="directory-result-count">{filtered.length} results</span></div>
          <div className="directory-filters">
            <label className="directory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, external ID…" /></label>
            <label className="directory-select"><span>Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All types</option><option value="HUMAN">Human</option><option value="SERVICE">Service</option><option value="WORKLOAD">Workload</option><option value="AI_AGENT">AI agent</option></select><ChevronDown size={13} /></label>
            <label className="directory-select"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select><ChevronDown size={13} /></label>
          </div>
          <div className="directory-table-wrap">
            <table className="directory-table">
              <thead><tr><th>Identity</th><th>Type</th><th>Status</th><th>Source</th><th>Last updated</th>{canManage && <th>Actions</th>}</tr></thead>
              <tbody>
                {filtered.map((identity) => <tr key={identity.id}>
                  <td><strong>{identity.displayName}</strong><span>{identity.email || identity.externalId || "No email or external ID"}</span></td>
                  <td><span className="identity-type">{typeLabels[identity.type]}</span></td>
                  <td><span className={"identity-status " + identity.status.toLowerCase()}><i />{identity.status.toLowerCase()}</span></td>
                  <td>{identity.source || "—"}</td>
                  <td>{new Date(identity.updatedAt).toLocaleDateString()}</td>
                  {canManage && <td><form action={updateIdentityStatus} className="identity-status-form"><input type="hidden" name="identityId" value={identity.id} /><select name="status" defaultValue={identity.status} aria-label={"Update status for " + identity.displayName}><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select><button type="submit">Save</button></form></td>}
                </tr>)}
                {filtered.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="directory-empty">No identities match these filters. Try a different search or add an identity.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="directory-footnote">Identity records are scoped to {organizationName}. Changes are recorded in the audit event log.</div>
        </section>
        <footer className="page-footer"><span>© 2026 NexusID · Identity security, made accountable.</span><a href="/">Return to command center</a></footer>
      </div>
    </main>
  );
}
