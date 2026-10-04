import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Narrator's Desk",
    short_name: "Narrator's Desk",
    description: "Private ElevenLabs batch narrator for Serious History.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#000000",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
