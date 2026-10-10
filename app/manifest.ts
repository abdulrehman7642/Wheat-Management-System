import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Malik Yaseen & Company",
    short_name: "Malik Yaseen",
    description: "Wheat business management system",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}