import { requireDashboardSession } from "@/lib/session";
import { AnkeRemote } from "@/components/anke-remote";

export default async function AnkeRemotePage() {
  await requireDashboardSession();
  return <AnkeRemote />;
}
