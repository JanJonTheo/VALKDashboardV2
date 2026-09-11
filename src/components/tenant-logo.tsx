"use client";

import Image from "next/image";
import { useState } from "react";
import type { DashboardSession } from "@/lib/access";

export function TenantLogo({ tenant }: { tenant: DashboardSession["tenant"] }) {
  const source = tenant.logoUrl ?? "/valkyries-trade-war.jpg";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === source) {
    return (
      <span
        className="tenant-logo-fallback"
        role="img"
        aria-label={`${tenant.name} logo unavailable`}
      >
        {tenant.name
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 3)
          .join("")}
      </span>
    );
  }
  return (
    <Image
      key={source}
      src={source}
      alt={`${tenant.name} logo`}
      width={200}
      height={200}
      unoptimized
      loading="eager"
      onError={() => setFailedSource(source)}
    />
  );
}
