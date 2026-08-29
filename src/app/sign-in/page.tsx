import { redirect } from "next/navigation";
import Image from "next/image";
import { cookies } from "next/headers";
import { SignInOptions } from "@/components/sign-in-options";
import { getDashboardSession } from "@/lib/session";
import { getTenantConfigs } from "@/lib/tenant-config";
import { configuredSocialProviders } from "@/lib/better-auth";
import {
  LOGIN_TENANT_COOKIE,
  resolveLoginTenantId,
} from "@/lib/login-preference";

export default async function SignInPage() {
  if (await getDashboardSession()) redirect("/");
  const tenants = (await getTenantConfigs()).map(({ id, name }) => ({
    id,
    name,
  }));
  const discordEnabled = configuredSocialProviders().includes("discord");
  const savedTenantId = (await cookies()).get(LOGIN_TENANT_COOKIE)?.value;
  const defaultTenantId = resolveLoginTenantId(
    tenants.map((tenant) => tenant.id),
    savedTenantId,
  );
  return (
    <main className="sign-in-page">
      <section className="sign-in-card">
        <div className="brand sign-in-brand">
          <span className="brand-signet sign-in-signet">
            <Image
              src="/valkyries-trade-war.jpg"
              alt="Valkyries of Trade & War"
              width={200}
              height={200}
              priority
            />
          </span>
        </div>
        <p className="eyebrow">COMMAND DASHBOARD V2</p>
        <h1>
          Squadron intelligence.
          <br />
          One secure view.
        </h1>
        <p>
          Choose your tenant, then sign in with your existing credentials or a
          previously linked Discord account.
        </p>
        <SignInOptions
          tenants={tenants}
          defaultTenantId={defaultTenantId}
          discordEnabled={discordEnabled}
        />
      </section>
    </main>
  );
}
