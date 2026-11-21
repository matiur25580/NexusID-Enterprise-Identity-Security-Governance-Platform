import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard-client";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) redirect("/onboarding");

  return (
    <DashboardClient
      userName={session.user.name ?? session.user.email ?? "NexusID user"}
      organizationName={membership.organization.name}
      role={membership.role}
    />
  );
}
