import { systemWatchlistEntrySchema } from "@/lib/system-watchlist";

export const watchlistLabelsSchema = systemWatchlistEntrySchema.pick({
  system: true,
  sector: true,
  projectName: true,
});

export interface WatchlistLabels {
  system: string;
  sector: string;
  projectName: string;
}

export function systemExternalLinks(system: string) {
  const name = encodeURIComponent(system.trim());
  return [
    { label: "Raven Colonial", href: `https://ravencolonial.com/#sys=${name}` },
    {
      label: "Inara",
      href: `https://inara.cz/elite/starsystem/?search=${name}`,
    },
    { label: "Spansh", href: `/api/system-watchlist/spansh?system=${name}` },
  ];
}
