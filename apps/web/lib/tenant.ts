import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getTenantContext() {
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) redirect("/onboarding");

  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "NexusID user",
    organization: membership.organization,
    membership,
  };
}
