import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrganizationForm from "./organization-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existingMembership) redirect("/");

  return (
    <main className="auth-shell">
      <section className="auth-card onboarding-card">
        <div className="auth-brand"><span className="brand-mark">N</span><span>NEXUS<span className="brand-light">ID</span></span></div>
        <p className="auth-eyebrow">GETTING STARTED</p>
        <h1>Create your workspace</h1>
        <p className="auth-description">Set up your organization. Your account will be assigned the owner role, and all workspace records will be tenant-scoped.</p>
        <OrganizationForm />
      </section>
    </main>
  );
}
