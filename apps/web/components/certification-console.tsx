"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardCheck, Plus, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { createCertificationCampaign, decideCertificationItem } from "@/app/certifications/actions";

type Item = {
  id: string; status: string; decisionReason: string | null; decidedAt: string | null; reviewer: string | null;
  grantStatus: string; grantedAt: string; identityName: string; identityEmail: string | null; identityType: string;
  entitlementName: string; entitlementKey: string; applicationName: string;
};
type Campaign = {
  id: string; name: string; description: string | null; status: string; dueAt: string; createdAt: string;
  completedAt: string | null; createdBy: string; items: Item[];
};
const empty: { error?: string; success?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}><Plus size={14}/>{pending ? "Creating…" : "Launch campaign"}</button>;
}
function CampaignForm() {
  const [state, action] = useActionState(createCertificationCampaign, empty);
  const [dueAt, setDueAt] = useState("");
  return <form action={action} className="cert-form">
    <label>Campaign name<input name="name" required minLength={3} maxLength={120} placeholder="Q4 privileged access certification"/></label>
    <label>Review deadline<input name="dueAt" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label>
    <label className="cert-wide">Purpose and scope<textarea name="description" rows={2} maxLength={1500} placeholder="Describe the review objective and expected reviewer actions"/></label>
    {state.error && <p className="cert-error">{state.error}</p>}
    {state.success && <p className="cert-success">{state.success}</p>}
    <div className="cert-wide cert-submit"><SubmitButton/></div>
  </form>;
}

export default function CertificationConsole({ organizationName, role, campaigns }: { organizationName: string; role: string; campaigns: Campaign[] }) {
  const [selected, setSelected] = useState(campaigns[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const canReview = ["OWNER", "ADMIN", "SECURITY_ANALYST"].includes(role);
  const campaign = campaigns.find((entry) => entry.id === selected) ?? campaigns[0];
  const totalItems = campaigns.reduce((sum, entry) => sum + entry.items.length, 0);
  const pendingItems = campaigns.reduce((sum, entry) => sum + entry.items.filter((item) => item.status === "PENDING").length, 0);
  const completed = campaigns.filter((entry) => entry.status === "COMPLETED").length;

  return <main className="cert-shell">
    <header className="governance-topbar"><a href="/governance" className="directory-back"><ArrowLeft size={15}/> Access governance</a><div className="directory-workspace"><span>{organizationName}</span><span className="directory-role">{role.replaceAll("_"," ")}</span></div></header>
    <div className="governance-content">
      <div className="directory-heading"><div><div className="eyebrow"><span/> PERIODIC ACCESS REVIEW</div><h1>Access certifications</h1><p>Review existing access, record decisions and retain evidence for each certification.</p></div>{canReview && <button className="primary-button" onClick={() => setShowCreate((value) => !value)}><Plus size={15}/> New campaign</button>}</div>
      <div className="governance-stats cert-stats">
        <article><span><ClipboardCheck size={17}/></span><div><small>Campaigns</small><strong>{campaigns.length}</strong></div></article>
        <article><span><ShieldAlert size={17}/></span><div><small>Items awaiting review</small><strong>{pendingItems}</strong></div></article>
        <article><span><CheckCircle2 size={17}/></span><div><small>Completed campaigns</small><strong>{completed}</strong></div></article>
        <article><span><Users size={17}/></span><div><small>Access items in scope</small><strong>{totalItems}</strong></div></article>
      </div>
      {showCreate && <section className="governance-panel"><div className="governance-panel-heading"><div><h2>Launch certification campaign</h2><p>All active access grants in this workspace are snapshotted into the review.</p></div><button className="directory-close" onClick={() => setShowCreate(false)} aria-label="Close">×</button></div><CampaignForm/></section>}
      <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>Campaign history</h2><p>Choose a campaign to inspect review progress and evidence</p></div><span className="directory-result-count">{campaigns.length} campaigns</span></div>
        <div className="cert-campaign-list">
          {campaigns.map((entry) => {
            const pending = entry.items.filter((item) => item.status === "PENDING").length;
            const decided = entry.items.length - pending;
            const progress = entry.items.length ? Math.round((decided / entry.items.length) * 100) : 0;
            return <button type="button" key={entry.id} className={"cert-campaign-card " + ((campaign?.id === entry.id) ? "chosen" : "")} onClick={() => setSelected(entry.id)}>
              <span className="cert-campaign-top"><strong>{entry.name}</strong><span className={"governance-status " + entry.status.toLowerCase()}>{entry.status.replaceAll("_"," ").toLowerCase()}</span></span>
              <span className="cert-campaign-meta"><span><CalendarClock size={12}/> Due {new Date(entry.dueAt).toLocaleDateString()}</span><span>{decided}/{entry.items.length} reviewed</span></span>
              <span className="cert-progress"><i style={{width: progress + "%"}}/></span>
            </button>;
          })}
          {campaigns.length === 0 && <p className="governance-empty">No certification campaigns yet. Launch a campaign to review active grants.</p>}
        </div>
      </section>
      {campaign && <section className="governance-panel">
        <div className="governance-panel-heading"><div><h2>{campaign.name}</h2><p>{campaign.description || "No campaign description"} · Created by {campaign.createdBy}</p><p>Deadline {new Date(campaign.dueAt).toLocaleString()}</p></div><span className={"governance-status " + campaign.status.toLowerCase()}>{campaign.status.replaceAll("_"," ").toLowerCase()}</span></div>
        <div className="cert-item-list">
          {campaign.items.map((item) => <article className="cert-item" key={item.id}>
            <div className="cert-item-heading"><div><strong>{item.identityName}</strong><span>{item.identityEmail || item.identityType.replaceAll("_"," ")}</span></div><span className={"governance-status " + item.status.toLowerCase()}>{item.status.toLowerCase()}</span></div>
            <div className="cert-entitlement"><ShieldCheck size={14}/><div><strong>{item.entitlementName}</strong><span>{item.applicationName} · {item.entitlementKey}</span></div></div>
            <div className="cert-item-meta"><span>Granted {new Date(item.grantedAt).toLocaleDateString()}</span><span>Grant status: {item.grantStatus.toLowerCase()}</span></div>
            {item.status === "PENDING" && campaign.status === "IN_PROGRESS" && canReview && <form action={decideCertificationItem} className="cert-decision">
              <input type="hidden" name="itemId" value={item.id}/>
              <input name="reason" required minLength={5} maxLength={1200} placeholder="Evidence / decision rationale (required)"/>
              <button className="approve-button" name="decision" value="CERTIFIED" type="submit"><CheckCircle2 size={13}/> Certify</button>
              <button className="reject-button" name="decision" value="REVOKED" type="submit">Revoke</button>
            </form>}
            {item.decisionReason && <p className="cert-evidence">Decision by {item.reviewer || "Former reviewer"} · {item.decidedAt ? new Date(item.decidedAt).toLocaleString() : ""}<br/>{item.decisionReason}</p>}
          </article>)}
          {campaign.items.length === 0 && <p className="governance-empty">This campaign has no access items.</p>}
        </div>
      </section>}
      <footer className="page-footer"><span>© 2026 NexusID · Access certifications</span><a href="/governance">Return to access governance</a></footer>
    </div>
  </main>;
}
