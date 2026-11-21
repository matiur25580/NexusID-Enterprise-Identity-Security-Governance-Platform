"use client";

import SignOutButton from "@/components/sign-out-button";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  Users,
  Workflow,
} from "lucide-react";

const metrics = [
  { label: "Managed identities", value: "12,846", change: "+8.2%", positive: true, icon: Users },
  { label: "Access risks detected", value: "23", change: "−14.6%", positive: true, icon: ShieldEllipsis },
  { label: "Pending reviews", value: "148", change: "12 due today", positive: false, icon: Clock3 },
  { label: "Policy compliance", value: "96.8%", change: "+2.4%", positive: true, icon: ShieldCheck },
];

const activities = [
  { initials: "AK", title: "Privileged access approved", detail: "Aarav Kumar · Production / Kubernetes", time: "4 min ago", tone: "green" },
  { initials: "SC", title: "Service account flagged", detail: "svc-data-pipeline · Excessive permissions", time: "18 min ago", tone: "amber" },
  { initials: "MR", title: "Access certification completed", detail: "Maya Rao · Finance systems", time: "42 min ago", tone: "blue" },
  { initials: "ID", title: "Identity lifecycle event", detail: "New employee · Engineering", time: "1 hr ago", tone: "violet" },
];

const risks = [
  { name: "Dormant privileged accounts", count: 8, level: "Critical", width: "78%" },
  { name: "Orphaned service identities", count: 11, level: "High", width: "62%" },
  { name: "Over-permissioned users", count: 4, level: "Medium", width: "35%" },
];

const navGroups = [
  { label: "OVERVIEW", items: [{ label: "Command center", icon: LayoutDashboard, active: true }, { label: "Risk intelligence", icon: Activity }, { label: "Identity graph", icon: Network }] },
  { label: "GOVERNANCE", items: [{ label: "Identity directory", icon: Users }, { label: "Access governance", icon: CheckCircle2 }, { label: "Access certifications", icon: ClipboardCheck }, { label: "Policy studio", icon: Workflow }, { label: "Privileged access", icon: LockKeyhole }] },
  { label: "PLATFORM", items: [{ label: "Integrations", icon: Fingerprint }, { label: "Audit & evidence", icon: KeyRound }] },
];

export default function DashboardClient({ userName, organizationName, role }: { userName: string; organizationName: string; role: string }) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="NexusID home">
          <span className="brand-mark"><Fingerprint size={21} /></span>
          <span>NEXUS<span className="brand-light">ID</span><small>IDENTITY SECURITY</small></span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-avatar">{organizationName.slice(0, 1).toUpperCase()}</div>
          <div className="workspace-copy"><strong>{organizationName}</strong><span>Enterprise workspace</span></div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-heading">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return <a className={item.active ? "nav-link active" : "nav-link"} href={item.label === "Identity directory" ? "/identities" : item.label === "Access governance" ? "/governance" : item.label === "Access certifications" ? "/certifications" : item.label === "Policy studio" ? "/policies" : "#"} key={item.label}><Icon size={17} /><span>{item.label}</span>{item.label === "Access reviews" && <span className="nav-count">6</span>}</a>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card"><div className="security-card-icon"><ShieldCheck size={17} /></div><strong>Security posture</strong><span>All core systems operational</span><div className="security-meter"><i /></div><small>Last assessed 8 minutes ago</small></div>
          <div className="profile"><div className="profile-avatar">{userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{userName}</strong><span>{role.replaceAll("_", " ").toLowerCase()}</span></div><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>Command center</strong></div>
          <div className="top-actions"><span className="environment"><i /> Production environment</span><button className="icon-button" aria-label="Search"><Search size={18} /></button><button className="icon-button" aria-label="Notifications"><CircleAlert size={18} /><i className="notification-dot" /></button><div className="top-avatar">{userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><SignOutButton /></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow"><span /> IDENTITY SECURITY OVERVIEW</div><h1>Good morning, {userName.split(" ")[0] || "there"} <span>✦</span></h1><p>Here’s your organization’s identity security posture today.</p></div>
            <a className="primary-button" href="/identities"><Plus size={16} /> Add identity</a>
          </div>

          <div className="metric-grid">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-value">{metric.value}</div><div className={metric.positive ? "metric-change positive" : "metric-change neutral"}>{metric.positive ? <ArrowUpRight size={14} /> : <Clock3 size={13} />}{metric.change}<span>{metric.positive ? " vs last month" : ""}</span></div></article>;
            })}
          </div>

          <div className="section-grid">
            <section className="panel risk-panel">
              <div className="panel-heading"><div><h2>Identity risk overview</h2><p>Priority findings across your environment</p></div><button className="subtle-button">View all findings <ArrowUpRight size={14} /></button></div>
              <div className="risk-summary"><div><span className="risk-number">23</span><span className="risk-caption">Open findings</span></div><div className="risk-divider" /><div><span className="risk-number small">3</span><span className="risk-caption">Require attention</span></div><div className="risk-status"><span /> Live monitoring</div></div>
              <div className="risk-list">{risks.map((risk) => <div className="risk-row" key={risk.name}><div className="risk-row-top"><span>{risk.name}</span><span className={"risk-level " + risk.level.toLowerCase()}>{risk.level} <b>{risk.count}</b></span></div><div className="risk-track"><i style={{ width: risk.width }} /></div></div>)}</div>
              <div className="panel-footnote"><CircleAlert size={14} /> Illustrative findings — connect an identity source to view live risk.</div>
            </section>

            <section className="panel posture-panel">
              <div className="panel-heading"><div><h2>Governance posture</h2><p>Policy and access health</p></div><button className="more-button" aria-label="More options"><MoreHorizontal size={19} /></button></div>
              <div className="score-wrap"><div className="score-ring"><div><strong>96.8</strong><span>/ 100</span></div></div><div className="score-copy"><strong>Strong posture</strong><span>+2.4% from last month</span><small>Based on 8 governance controls</small></div></div>
              <div className="control-list"><div><span><CheckCircle2 size={15} /> MFA enforcement</span><strong>100%</strong></div><div><span><CheckCircle2 size={15} /> Least privilege</span><strong>94%</strong></div><div><span><CheckCircle2 size={15} /> Access reviews</span><strong>91%</strong></div></div>
              <div className="panel-footnote"><ShieldCheck size={14} /> Illustrative posture score; baseline policy engine available.</div>
            </section>
          </div>

          <section className="panel activity-panel">
            <div className="panel-heading"><div><h2>Recent security activity</h2><p>Identity events across your organization</p></div><button className="subtle-button">View audit trail <ArrowUpRight size={14} /></button></div>
            <div className="activity-table"><div className="activity-header"><span>EVENT</span><span>ACTOR / RESOURCE</span><span>TIME</span><span>STATUS</span></div>{activities.map((item) => <div className="activity-row" key={item.title}><div className="activity-event"><span className={"activity-avatar " + item.tone}>{item.initials}</span><strong>{item.title}</strong></div><span className="activity-detail">{item.detail}</span><span className="activity-time">{item.time}</span><span className={"status-pill " + item.tone}><i />{item.tone === "amber" ? "Investigate" : "Recorded"}</span></div>)}</div>
            <div className="panel-footnote"><Bot size={14} /> Demo activity only. No real identities or access decisions are represented.</div>
          </section>

          <footer className="page-footer"><span>© 2026 NexusID · Identity security, made accountable.</span><span><span className="footer-dot" /> All systems nominal <span className="footer-separator">·</span> v0.1.0-foundation</span></footer>
        </div>
      </section>
    </main>
  );
}
