import { redirect } from "next/navigation";
import { ProtectedFactionAdministration } from "@/components/protected-faction-administration";
import { getDashboardSession } from "@/lib/session";

export default async function ProtectedFactionsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in");
  if (!session.capabilities.includes("protected-factions:manage"))
    redirect("/");
  return <ProtectedFactionAdministration />;
}
