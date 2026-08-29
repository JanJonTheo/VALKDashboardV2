import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VALK Command Dashboard",
    short_name: "VALK",
    description: "Squadron analytics, operations and intelligence",
    start_url: "/",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    orientation: "any",
  };
}
