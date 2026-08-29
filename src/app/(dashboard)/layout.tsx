import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PasswordChangeCard } from "@/components/password-change-card";
import { getDashboardSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in");
  return (
    <AppShell session={session}>
      {session.mustChangePassword ? <PasswordChangeCard forced /> : children}
    </AppShell>
  );
}
