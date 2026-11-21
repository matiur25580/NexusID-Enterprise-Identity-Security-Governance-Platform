# NexusID

<p align="center"><strong>Enterprise Identity Security · Access Governance · Zero-Trust Policy Intelligence</strong></p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma">
  <img alt="CI" src="https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions">
  <img alt="Status" src="https://img.shields.io/badge/Status-Active_Development-blue">
</p>

NexusID is a multi-tenant identity security and access-governance platform prototype. It brings workforce identities, service accounts, workloads and AI-agent identities into a common governance workflow: discover identities, catalogue entitlements, request and approve access, certify existing grants, evaluate policy and explain identity risk.

> **Honest project status:** This is an actively developed portfolio project, not a production-certified IAM/IGA product. Authentication, tenant-aware application workflows, policy evaluation, access governance, certifications and explainable risk features are implemented. The command-center overview still contains illustrative metrics and activity data. Inbound SCIM 2.0 Users and Groups provisioning is implemented with approval-gated entitlement mappings; outbound provisioning, SAML federation, privileged session brokering and compliance certification are not claimed.

## Contents

- [Product overview](#product-overview)
- [Dashboard and product UI gallery](#dashboard-and-product-ui-gallery)
- [Implemented capabilities](#implemented-capabilities)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Database and migrations](#database-and-migrations)
- [Tests and CI](#tests-and-ci)
- [Scheduled risk intelligence](#scheduled-risk-intelligence)
- [Identity lifecycle management](#identity-lifecycle-management)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [Security disclosure](#security-disclosure)

## Product overview

Identity sprawl now includes employees, service accounts, workloads, automation and AI agents. NexusID is designed around five questions:

1. **Who is the identity?** Human and non-human directory records with lifecycle status.
2. **What can it access?** Application entitlements and active access grants.
3. **Why does it have access?** Request rationale, approval decision, policy outcome and audit evidence.
4. **Should it still have access?** Certification campaigns and revocation workflows.
5. **How risky is it?** Transparent identity-risk factors, daily history and escalation signals.

The project emphasizes least privilege, tenant isolation, human accountability and deterministic explainability over opaque automation.

## Dashboard and product UI gallery

The following 12 single-column visuals are **designed product-interface concepts**, not screenshots captured from a running deployment. They illustrate the intended information architecture. Current implemented surfaces and roadmap concepts are explicitly distinguished.

### 01 · Identity security command center — implemented shell

A high-level operational landing page for posture indicators, governance workload and recent activity. KPI values and activity feed are illustrative demo data, not live organization telemetry.

![NexusID command center concept](docs/images/dashboard-01-command-center.svg)

### 02 · Identity directory — implemented

Tenant-scoped inventory for human, service, workload and AI-agent identities, with status governance and explainable risk factors. Current directory query is capped at 250 recently updated records.

![NexusID identity directory concept](docs/images/dashboard-02-identity-directory.svg)

### 03 · Identity risk intelligence — implemented

Deterministic risk scoring exposes named signals and weights. Daily snapshots provide historical average scores and elevated-risk counts after data capture begins.

![NexusID risk intelligence concept](docs/images/dashboard-03-risk-intelligence.svg)

### 04 · Risk escalation center — implemented backend and directory panel

Scheduled assessments can flag entry into critical risk (75+) or a score increase of at least 15 points. Alerts are persisted and displayed; external notification delivery is not implemented.

![NexusID risk alert concept](docs/images/dashboard-04-risk-alerts.svg)

### 05 · Access governance — implemented

Application entitlements, access requests, human approval decisions and active/revoked grants are managed inside the organization scope. Policy is re-evaluated before approval.

![NexusID access governance concept](docs/images/dashboard-05-access-governance.svg)

### 06 · Access certification — implemented

Campaigns snapshot active grants for review. Reviewers certify or revoke each item with a rationale. Reviewer assignment, reminders and escalation remain future work.

![NexusID certification concept](docs/images/dashboard-06-certifications.svg)

### 07 · Policy studio — implemented

Immutable baseline controls and configurable tenant policies support simulation, priority and version history. An ALLOW result never bypasses human approval.

![NexusID policy studio concept](docs/images/dashboard-07-policy-studio.svg)

### 08 · Audit and evidence explorer — roadmap concept

A future searchable event workspace for actor, subject, action, outcome, reason and correlation evidence. Audit events exist in current workflows; a dedicated explorer/export interface does not yet exist.

![NexusID audit explorer concept](docs/images/dashboard-08-audit-evidence.svg)

### 09 · Privileged access workspace — roadmap concept

A future just-in-time privileged-access experience with approvals, expiry, session context and revocation evidence. Privileged entitlement metadata currently informs governance and risk scoring; there is no PAM session broker.

![NexusID privileged access concept](docs/images/dashboard-09-privileged-access.svg)

### 10 · Identity lifecycle orchestration — roadmap concept

A future joiner/mover/leaver workflow with approvals, idempotent provisioning jobs, retries and reconciliation. External account provisioning is not currently available.

![NexusID lifecycle concept](docs/images/dashboard-10-lifecycle.svg)

### 11 · Integrations and connector health — roadmap concept

A future connector control plane for OIDC, SAML, SCIM and cloud identity sources, including sync health and credential rotation. Current Google/GitHub OAuth is for application sign-in, not directory provisioning.

![NexusID integrations concept](docs/images/dashboard-11-integrations.svg)

### 12 · AI and workload identity governance — roadmap concept

A future governance surface for AI agents, service principals and workloads, including ownership, purpose, credential posture and least-privilege review. The directory supports these identity types; automated discovery and runtime controls do not yet exist.

![NexusID AI/workload governance concept](docs/images/dashboard-12-ai-workload.svg)

## Implemented capabilities

| Area | Status | Current behavior |
|---|---|---|
| Authentication and workspace | Implemented | Auth.js v5, configurable OAuth, database sessions, organization membership |
| Identity directory | Implemented | Tenant-scoped create/status workflows for human and non-human identities |
| Entitlement catalogue | Implemented | Organization-scoped applications and entitlements |
| Access governance | Implemented | Request, approve, reject and revoke with audit events |
| Policy engine | Implemented | Deterministic baseline DENY/REVIEW/ALLOW and approval-time re-evaluation |
| Configurable policies | Implemented | Supported conditions, priority, version history and exact-version simulation gate |
| Access certification | Implemented | Campaign snapshots, reviewer decisions, certify/revoke |
| Identity risk | Implemented | Explainable deterministic scoring and daily snapshots |
| Risk alerts | Implemented | Critical threshold and material score-increase alerts |
| Identity lifecycle | Implemented | Approval-controlled Joiner, Mover and Leaver workflows with transactional execution and audit events |
| SCIM 2.0 Users | Implemented (initial scope) | Tenant-bound bearer connectors, SCIM User CRUD/PATCH/deactivate, hashed secrets and audit events |
| Tenant integration tests | Implemented | PostgreSQL-backed tenant query and membership-role checks in CI |
| SCIM Groups / outbound provisioning | Roadmap | Initial inbound SCIM Users API only; no Groups or outbound reconciliation worker |
| JIT/PAM sessions | Roadmap | No session broker or credential vault |
| Lifecycle provisioning | Roadmap | No external provisioning worker |
| SIEM/SOAR delivery | Roadmap | No external alert delivery |
| Compliance certification | Not claimed | Requires independent control mapping and audit evidence |

## Architecture

NexusID currently uses a modular monolith: one deployable Next.js application with explicit domain boundaries.

```text
Browser / Operator
       |
       v
Next.js App Router (apps/web)
       +-- Auth.js and tenant context
       +-- Server actions and API handlers
       +-- Identity and entitlement governance
       +-- Policy evaluation and simulation
       +-- Certification workflows
       +-- Explainable risk scoring
       +-- Joiner / Mover / Leaver lifecycle requests
       |
       v
Prisma (tenant-scoped data access)
       |
       v
PostgreSQL
       +-- Organizations / memberships / identities
       +-- Applications / entitlements / grants
       +-- Policies / versions / certifications
       +-- Audit events / risk snapshots / alerts / lifecycle requests

GitHub Actions
       +-- CI and PostgreSQL integration tests
       +-- Daily authenticated risk assessment
```

**Architecture decisions**

- Start with a modular monolith; extract workers only when scale or operational ownership warrants it.
- Resolve tenant context and authorization on the server; never trust a browser-supplied organization ID.
- Use transactions for multi-record governance decisions.
- Use unique constraints and idempotent inserts for repeated daily snapshots and alerts.
- Keep policy and risk evaluation deterministic and explainable.
- Record security-relevant workflow outcomes in audit events.

## Security model

- **Tenant isolation:** tenant-owned queries include the authenticated organization scope. Integration tests create two organizations and verify scoped identity/audit visibility.
- **Least privilege:** roles include OWNER, ADMIN, SECURITY_ANALYST, AUDITOR and MEMBER; sensitive mutations check roles server-side.
- **Policy precedence:** immutable baseline DENY controls cannot be overridden; DENY takes precedence over REVIEW, which takes precedence over ALLOW.
- **Human approval:** ALLOW is not an automatic grant. Access approval is a separate authorized action and policies are re-evaluated at approval time.
- **Explainable risk:** scores are deterministic heuristics, not probabilities, AI verdicts or ML predictions.
- **Scheduled endpoint:** requires a server-only high-entropy bearer secret (minimum 32 characters), compared in constant time.
- **Auditability:** workflow actions and scheduled assessments write organization-scoped audit events. Application-level append-only conventions are not tamper-proof/WORM storage.
- **Production hardening still required:** PostgreSQL RLS, independent penetration testing, formal threat modeling, operational incident response and production secret management.

## Technology stack

| Layer | Technology |
|---|---|
| Web | Next.js 16 App Router, React 19 |
| Language | TypeScript 5.9 |
| UI | Tailwind CSS 4, Lucide React, custom responsive components |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 |
| Authentication | Auth.js v5 beta, OAuth |
| Validation | Zod 4 |
| Testing | Node.js test runner, PostgreSQL integration tests |
| CI | GitHub Actions |
| Local services | Docker Compose; PostgreSQL and Redis (Redis reserved for future workers) |

## Repository structure

```text
.
├── .github/workflows/       # CI and scheduled risk assessment
├── apps/web/
│   ├── app/                 # Routes, server actions, internal API
│   ├── components/          # Dashboard and governance UI
│   ├── lib/                 # Authorization, policy and risk logic
│   ├── prisma/              # Schema and SQL migrations
│   └── tests/               # Database integration tests
├── docs/
│   ├── images/              # README UI concept visuals
│   └── *.md                 # Architecture and feature guides
├── tests/                   # Policy and risk unit/regression tests
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Getting started

### Prerequisites

- Node.js 20.9+ (Node 22 recommended)
- pnpm 9.15+
- Docker Engine/Desktop with Compose, or PostgreSQL 16

### 1. Clone and install

```bash
git clone https://github.com/matiur25580/NexusID-Enterprise-Identity-Security-Governance-Platform.git
cd NexusID-Enterprise-Identity-Security-Governance-Platform
pnpm install
```

### 2. Start services and configure environment

```bash
docker compose up -d postgres
cp .env.example .env
```

Set a strong `AUTH_SECRET` and configure at least one OAuth provider if you need sign-in. Sample database credentials are for local development only.

### 3. Generate Prisma Client and prepare local database

```bash
pnpm db:generate
pnpm db:validate
pnpm db:push
```

For a fresh local database, `db:push` syncs the schema. For shared/production environments, do not use `db:push`; review migrations, back up and deploy through a controlled migration process.

### 4. Start the application

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

OAuth callbacks:

- Google: `http://localhost:3000/api/auth/callback/google`
- GitHub: `http://localhost:3000/api/auth/callback/github`

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js secret |
| `AUTH_URL` | Canonical application URL |
| `NEXT_PUBLIC_APP_URL` | Public application origin |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Optional Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Optional GitHub OAuth |
| `REDIS_URL` | Reserved for future background workers |
| `NEXUSID_RISK_SNAPSHOT_SECRET` | Server-only secret for scheduled assessments |

Generate a random secret with `openssl rand -hex 32`. Never commit real secrets or expose the scheduled secret with a `NEXT_PUBLIC_` prefix.

## Database and migrations

The Prisma schema contains organizations, identities, SCIM connectors, memberships, entitlements, grants, policies, certifications, audit events, risk snapshots and risk alerts.

New risk-alert table migration: `apps/web/prisma/migrations/20261121113000_add_identity_risk_alerts/migration.sql`.

**Migration-history caveat:** the project began with schema-first development and does not yet have a complete production migration baseline. Review SQL against the actual target schema and establish a baseline before relying on `prisma migrate deploy`. Back up first. Never run `db:push` against production.

## Tests and CI

```bash
pnpm test:policy
pnpm test:risk-alerts
NEXUSID_INTEGRATION_TEST=1 pnpm test:integration
pnpm db:generate
pnpm db:validate
pnpm typecheck
pnpm build
```

The tenant integration suite requires a dedicated PostgreSQL database named `nexusid`, refuses production mode and cleans up fixtures. GitHub Actions provisions an ephemeral PostgreSQL 16 service before running the suite.

## Scheduled risk intelligence

A GitHub Actions workflow runs daily at **02:15 UTC** and supports manual dispatch. It calls `POST /api/internal/risk-snapshots` and:

1. Authenticates the request using the server-only bearer secret.
2. Processes each organization independently.
3. Calculates deterministic risk from identity state and active entitlements.
4. Stores one snapshot per identity per UTC date.
5. Detects critical threshold crossings (75+) and score increases of at least 15 points.
6. Persists alerts and an organization-scoped audit event.

Configure these GitHub repository Actions secrets:

- `NEXUSID_APP_URL` — deployed application origin.
- `NEXUSID_RISK_SNAPSHOT_SECRET` — same high-entropy value as the app's server environment variable.

If secrets are missing, the workflow warns and safely skips. The application must be deployed and reachable for scheduled snapshots to run. External email/chat/SIEM alert delivery is not included.

## SCIM 2.0 provisioning (inbound Users and Groups)

The /integrations/scim workspace creates organization-bound SCIM bearer connectors. Each generated token is displayed once; only its SHA-256 hash is stored. Configure the source URL as https://YOUR_HOST/api/scim/v2 and use the token as an HTTP Bearer credential.

Implemented endpoints: GET/POST /Users and /Groups, plus GET/PUT/PATCH/DELETE /Users/{id} and /Groups/{id}. User collection filters support exact userName and externalId equality; both collections support bounded startIndex/count pagination. Group membership accepts only identities provisioned by the same connector. Deactivation disables identities and revokes active NexusID grants transactionally. Group-to-entitlement mappings create policy-evaluated PENDING access requests only; human approval remains mandatory.

This is an inbound Users/Groups service-provider implementation, not a complete SCIM suite. Outbound provisioning, background reconciliation, retries, rate limiting and production connector health monitoring remain future work. Use TLS, store the token in a secret manager, rotate credentials and put an API gateway/WAF with rate limits in front of the endpoint.

## Identity lifecycle management

The `/lifecycle` workspace provides approval-controlled identity lifecycle requests:

- **Joiner:** an approver activates an existing PENDING identity.
- **Mover:** an approver revokes only explicitly selected active grants belonging to that identity.
- **Leaver:** an approver disables the identity and revokes all of its active grants in one database transaction.
- Every request and decision records organization-scoped audit evidence and requires a reason.
- Requests are tenant-scoped, duplicate pending requests for one identity are blocked, and concurrent decisions use conditional updates.

This is an internal governance workflow, not an external provisioning connector. It does not create accounts in third-party directories, update external group memberships, or run automatic retries/reconciliation. A future SCIM connector can consume the approved lifecycle intent through a separately secured integration worker.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Identity directory](docs/IDENTITY_DIRECTORY.md)
- [Access governance](docs/ACCESS_GOVERNANCE.md)
- [Access certifications](docs/ACCESS_CERTIFICATIONS.md)
- [Baseline policy engine](docs/POLICY_ENGINE.md)
- [Configurable policies](docs/CONFIGURABLE_POLICIES.md)
- [Identity risk intelligence](docs/IDENTITY_RISK_INTELLIGENCE.md)
- [Tenant tests and risk trends](docs/SECURITY_TESTING_AND_RISK_TRENDS.md)
- [Scheduled risk assessments](docs/SCHEDULED_RISK_ASSESSMENTS.md)
- [SCIM 2.0 provisioning and group entitlement governance](docs/SCIM_PROVISIONING.md)

## Roadmap

- [x] Multi-tenant foundation, Auth.js and role-aware workspaces
- [x] Identity directory and entitlement catalogue
- [x] Access request, approval and revocation workflows
- [x] Certification campaigns
- [x] Baseline and configurable policy engine with simulation gate
- [x] Explainable identity risk scoring and daily snapshots
- [x] Risk escalation detection and scheduled assessment endpoint
- [x] Approval-controlled Joiner / Mover / Leaver lifecycle workflows
- [x] PostgreSQL tenant-isolation integration checks in CI
- [x] SCIM 2.0 inbound Users provisioning API (initial scope)
- [x] SCIM Groups inbound synchronization and approval-gated entitlement mappings
- [ ] Outbound provisioning and reconciliation worker
- [ ] SCIM 2.0 / SAML 2.0 connector framework
- [ ] Privileged session brokering and time-bound access
- [ ] Alert acknowledgement and email/chat/SIEM delivery
- [ ] Audit search/export and tamper-evident evidence storage
- [ ] Full authenticated end-to-end tests and PostgreSQL RLS
- [ ] Independent security review and production hardening

## Known limitations

- Command-center KPI/activity values are illustrative, not live tenant telemetry.
- Risk weights are initial heuristics and require security-stakeholder calibration.
- The scheduled workflow requires a deployed, reachable app and configured GitHub secrets; CI does not verify deployment secrets.
- Alerts are persisted and shown in the directory; notification delivery and acknowledgement are not implemented.
- SCIM inbound directory synchronization is implemented; outbound account provisioning, downstream deprovisioning and reconciliation are not implemented.
- No SOC 2, ISO 27001 or other compliance certification is claimed.
- Tenant query scoping needs PostgreSQL RLS and further adversarial testing before production use.

## Contributing

Please include the problem statement, expected behavior, security/tenant impact, tests for allow/deny/failure paths, and migration/rollback notes. Screenshots should reflect the actual implemented interface. Keep changes focused and never commit credentials or real identity data.

## Security disclosure

Do not publish exploit details for an unpatched vulnerability. Contact the repository owner privately through GitHub's security contact mechanism. Never include production credentials, tokens or personal identity data in issues or pull requests.
