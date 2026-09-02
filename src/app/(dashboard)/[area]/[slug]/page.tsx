import { notFound } from "next/navigation";
import { FeatureDashboard } from "@/components/feature-dashboard";
import { SystemWatchlist } from "@/components/system-watchlist";
import { BgsAlerts } from "@/components/bgs-alerts";
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
      <SystemWatchlist
        tenantFactionName={session.tenant.factionName ?? ""}
        canManageTenantRules={session.capabilities.includes(
          "tenant-rules:write",
        )}
        canRunBgsAi={session.capabilities.includes("bgs-ai:run")}
      />
    );
  if (area === "intelligence" && slug === "alerts") return <BgsAlerts />;
  const spec = findFeature(area, slug);
  if (!spec) notFound();
  return <FeatureDashboard key={spec.key} spec={spec} session={session} />;
}
