import type { NextConfig } from "next";
import path from "node:path";

// Baseline security headers on every route. The Content-Security-Policy is NOT
// here on purpose: it is built per request with a nonce in src/proxy.ts, and a
// second CSP header would break Next's script tagging.
const securityHeaders = [
  // Secret links are credentials. Never leak them to another site as a Referer.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // camera=() blocks in-page camera APIs only. <input type="file" capture> still
  // opens the phone's own camera app, so photo uploads keep working.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Secret-link pages and API responses: never cached by shared caches, never indexed.
const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Add every secret-link route prefix here (e.g. /p/:path* for a payer view).
      { source: "/t/:path*", headers: privateHeaders },
      { source: "/api/:path*", headers: privateHeaders },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Lets you open the dev server from your phone over Wi-Fi (hostname only).
  allowedDevOrigins: ["192.168.0.*", "192.168.1.*", "10.0.0.*"],
};

export default nextConfig;
