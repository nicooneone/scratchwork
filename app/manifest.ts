import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RedLine",
    short_name: "RedLine",
    description: "The notebook that checks your thinking.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f5ef",
    theme_color: "#1d2a44",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
