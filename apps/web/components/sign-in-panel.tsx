"use client";

import { signIn } from "next-auth/react";
import { Fingerprint, Github, Globe, ShieldCheck } from "lucide-react";

export default function SignInPanel({
  providers,
}: {
  providers: { google: boolean; github: boolean };
}) {
  const available = providers.google || providers.github;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><Fingerprint size={22} /></span>
          <span>NEXUS<span className="brand-light">ID</span></span>
        </div>
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="auth-eyebrow">IDENTITY SECURITY PLATFORM</p>
        <h1>Welcome to NexusID</h1>
        <p className="auth-description">Sign in securely to manage your organization’s identity governance.</p>
        <div className="auth-provider-list">
          {providers.google && (
            <button className="auth-provider" onClick={() => signIn("google", { redirectTo: "/" })}>
              <Globe size={17} /> Continue with Google
            </button>
          )}
          {providers.github && (
            <button className="auth-provider" onClick={() => signIn("github", { redirectTo: "/" })}>
              <Github size={17} /> Continue with GitHub
            </button>
          )}
        </div>
        {!available && (
          <div className="auth-setup-notice">
            <strong>Authentication setup required</strong>
            <p>Configure AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or AUTH_GITHUB_ID and AUTH_GITHUB_SECRET, in your environment to enable sign-in.</p>
          </div>
        )}
        <p className="auth-legal">Access is protected by OAuth sign-in and server-managed sessions. Your organization’s data is scoped by membership.</p>
      </section>
      <footer className="auth-footer">© 2026 NexusID · Identity security, made accountable.</footer>
    </main>
  );
}
