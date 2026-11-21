import { getTenantContext } from "@/lib/tenant";
import DashboardClient from "@/components/dashboard-client";

export default async function Home() {
  const context = await getTenantContext();

  return (
    <DashboardClient
      userName={context.userName}
      organizationName={context.organization.name}
      role={context.membership.role}
    />
  );
}
