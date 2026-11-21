# Authentication and tenant onboarding

NexusID uses Auth.js with the Prisma adapter and database-backed sessions. OAuth is the initial sign-in method; no local password store is implemented.

## Configure a provider

Configure at least one provider before signing in.

### Google

1. Create an OAuth 2.0 Web application credential in Google Cloud Console.
2. Add the callback URL to the authorized redirect URIs:
   `http://localhost:3000/api/auth/callback/google`
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

### GitHub

1. Register a GitHub OAuth App.
2. Set its callback URL to:
   `http://localhost:3000/api/auth/callback/github`
3. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

For production, register the corresponding HTTPS callback URL on your deployed domain and set the same environment variables in the production environment. Never commit real credentials.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: cryptographically random secret used by Auth.js.
- At least one OAuth provider's ID and secret.

Generate an Auth.js secret with:

```bash
openssl rand -base64 32
```

## Database setup

After installing dependencies:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

The Prisma schema contains the Auth.js adapter models (`Account`, `Session`, and `VerificationToken`) alongside NexusID's organization and membership domain.

## Organization onboarding

After OAuth sign-in:

- Users without a membership are redirected to `/onboarding`.
- Workspace creation runs in a database transaction.
- The creator receives the `OWNER` membership role.
- An `organization.created` audit event is written in the same transaction.
- The dashboard resolves the signed-in user's membership on the server.

## Authorization rules

Use `requireOrganizationRole(organizationId, allowedRoles)` from `lib/authorization.ts` in every future tenant-scoped mutation or data-access path. It checks the authenticated session and the exact organization/user membership pair in the database. Do not authorize from a client-provided role or organization ID alone.

Use `getTenantContext()` to resolve the user's initial workspace on the server. The current foundation selects the oldest membership; an explicit organization switcher and active-workspace selection are future work.

## Security notes

- Auth.js sessions are stored in PostgreSQL rather than browser-managed application JWTs.
- OAuth provider credentials and `AUTH_SECRET` belong in deployment environment secrets.
- Do not expose provider tokens to client components.
- Tenant-owned queries must always include the resolved `organizationId`.
- Do not treat dashboard sample metrics as live security telemetry.
- Before production, add rate limiting at the edge, security monitoring, account recovery policy, organization invitation controls, and integration tests for tenant isolation and authorization denial paths.
