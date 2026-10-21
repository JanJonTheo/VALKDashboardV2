import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AnkeRemote } from "@/components/anke-remote";
import { PasswordChangeCard } from "@/components/password-change-card";
import { getDashboardSession } from "@/lib/session";
import { redirect } from "next/navigation";
import "./remote.css";

export const metadata: Metadata = {
  title: "ANKe Remote · VALK",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090d",
};

export default async function MobileRemotePage() {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in?next=/remote");
  return (
    <main className="remote-app">
      <header className="remote-app-header">
        <Link href="/remote" className="remote-brand">
          VALK <span>REMOTE</span>
        </Link>
        <Link href="/operations/anke-remote">Dashboard</Link>
      </header>
      {session.mustChangePassword ? (
        <PasswordChangeCard forced />
      ) : (
        <AnkeRemote mobile />
      )}
    </main>
  );
}
