# NexusID

**Enterprise Identity Security, Access Governance & Zero-Trust Intelligence**

NexusID is an identity-security platform concept for organizations that need to understand *who and what* has access to their systems, why that access exists, and whether it is still appropriate.

> **Project status:** Foundation / early development. The current dashboard is a product shell with illustrative data; it is not connected to production identity providers and must not be used to make real access decisions.

## Product vision

NexusID brings workforce identities, service accounts, workload identities and AI-agent identities into one governance plane. It is designed around least privilege, explainable risk, auditable decisions and reliable lifecycle automation.

### Initial product areas

- **Identity directory** — people, service accounts, workloads and AI agents.
- **Access governance** — roles, entitlements, access requests and periodic certifications.
- **Lifecycle orchestration** — joiner, mover and leaver workflows with retryable provisioning.
- **Privileged access** — elevated access requests, approvals, expiry and session evidence.
- **Risk intelligence** — explainable identity and entitlement risk signals.
- **Policy studio** — simulate RBAC/ABAC and zero-trust decisions before enforcement.
- **Audit & compliance** — immutable-style event history and exportable evidence.
- **Integrations** — planned OIDC, SAML, SCIM and cloud-provider connectors.

## Technology direction

| Layer | Planned technology |
|---|---|
| Web application | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, accessible component primitives, Lucide |
| Data | PostgreSQL, Prisma |
| Async work | Redis + BullMQ; event streaming as scale requires |
| Identity protocols | OIDC, SAML 2.0, SCIM 2.0 |
| Validation | Zod |
| Testing | Vitest, Playwright |
| Delivery | Docker, GitHub Actions, OpenTelemetry |

The first milestone is intentionally a modular Next.js foundation. Domain modules will be kept separate so high-volume provisioning workers and protocol connectors can later move into independently deployed services without rewriting the product domain.

## Local development

Requirements: Node.js 20.9+ and pnpm 9+.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app runs at http://localhost:3000.

## Repository layout

```text
apps/
  web/                 Next.js application
    app/               App Router routes and global styles
    components/        Reusable UI components
    lib/               Shared application utilities
packages/
  (future shared packages)
prisma/
  schema.prisma        Initial multi-tenant domain model
docs/
  ARCHITECTURE.md      System boundaries and security principles
```

## Engineering principles

1. Enforce tenant scope and authorization on the server, never only in the UI.
2. Default to least privilege and deny when policy evaluation is indeterminate.
3. Make provisioning idempotent; retries must not create duplicate grants.
4. Keep human approval and policy controls around sensitive AI recommendations.
5. Record actor, subject, action, target, outcome and correlation ID for security-relevant events.
6. Treat connector credentials as secrets; encrypt at rest and never log them.
7. Test failure paths, tenant isolation and revocation—not only happy paths.

## Roadmap

- [x] Repository and application foundation
- [x] Initial multi-tenant identity domain schema
- [x] Authentication, organizations and server-side authorization
- [ ] Identity directory and entitlement catalog
- [ ] Access requests, approvals and certification campaigns
- [ ] Lifecycle workflows and connector framework
- [ ] Risk scoring, policy simulation and audit evidence
- [ ] Integration, security and end-to-end test suites

## Security

Do not deploy this project with real identity data until authentication, tenant isolation, authorization, secrets management, audit controls and security tests have been implemented and reviewed. Report suspected vulnerabilities privately to the repository owner rather than opening public issues with exploit details.
