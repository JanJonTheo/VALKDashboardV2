import { redirect } from "next/navigation";
import { UserAdministration } from "@/components/user-administration";
import { getDashboardSession } from "@/lib/session";

export default async function UsersPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in");
  if (!session.capabilities.includes("users:manage")) redirect("/");
  return <UserAdministration currentUserId={session.user.id} />;
}
