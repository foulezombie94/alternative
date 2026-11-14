import type { MetadataRoute } from "next";
import fr from "@/i18n/dictionaries/fr";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "alternative",
    short_name: "alternative",
    description: fr.metadata.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#17171a",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
