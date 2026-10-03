import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Narrator's Desk",
    short_name: "Narrator's Desk",
    description: "Private ElevenLabs batch narrator for Serious History.",
    start_url: "/",
    display: "standalone",
    background_color: "#12100d",
    theme_color: "#12100d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
