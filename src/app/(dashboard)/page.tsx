import { HomeDashboard } from "@/components/home-dashboard";
import { getDashboardSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getDashboardSession();
  if (!session) return null;
  return <HomeDashboard session={session} />;
}
