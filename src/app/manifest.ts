import type { MetadataRoute } from "next";
import { site } from "@/config/site";

// PNGs are rendered from src/app/icon.svg (the mark). iOS and most launchers
// ignore SVG icons, so the PNG and maskable sizes are what the Home Screen uses.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    // No start_url on purpose: it then defaults to the page the person was on
    // when they tapped "Add to Home Screen", so the icon opens their own
    // tracker (/t/<token>) instead of the home page. Don't add one back.
    display: "standalone",
    background_color: site.themeColor,
    theme_color: site.themeColor,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
