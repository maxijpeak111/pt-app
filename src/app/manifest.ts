import type { MetadataRoute } from "next";

// The "web app manifest": tells phones how to install this site as an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PT — Personal Training",
    short_name: "PT",
    description: "My personal training planner and session log.",
    start_url: "/planner",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
