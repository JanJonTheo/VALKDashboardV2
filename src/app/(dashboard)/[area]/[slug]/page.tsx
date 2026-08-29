import { notFound } from "next/navigation";
import { FeatureDashboard } from "@/components/feature-dashboard";
import { SystemWatchlist } from "@/components/system-watchlist";
import { findFeature } from "@/lib/features";
import { getDashboardSession } from "@/lib/session";

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ area: string; slug: string }>;
}) {
  const { area, slug } = await params;
  const session = await getDashboardSession();
  if (!session) return null;
  if (area === "intelligence" && slug === "watchlist")
    return (
      <SystemWatchlist tenantFactionName={session.tenant.factionName ?? ""} />
    );
  const spec = findFeature(area, slug);
  if (!spec) notFound();
  return <FeatureDashboard spec={spec} session={session} />;
}
