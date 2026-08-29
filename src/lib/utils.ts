import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)
      return Intl.NumberFormat("en-GB").format(value);
  }
  return String(value ?? "—");
}
