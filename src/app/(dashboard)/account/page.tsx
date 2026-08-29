import { redirect } from "next/navigation";
import { AccountProfile } from "@/components/account-profile";
import { configuredSocialProviders } from "@/lib/better-auth";
import { getDashboardSession } from "@/lib/session";

export default async function AccountPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in");
  return (
    <AccountProfile
      session={session}
      providers={configuredSocialProviders()}
    />
  );
}
