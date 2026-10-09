import type { CspDirectives } from "@/lib/csp";

// Per-tool additions to the Content-Security-Policy, merged into the strict
// defaults in src/lib/csp.ts. Add only the origins a feature actually needs and
// say why next to each one, e.g.:
//
//   "connect-src": ["https://*.ingest.uploadthing.com"], // photo upload PUT
//   "img-src": ["https://*.ufs.sh"],                       // stored receipt photos
//
// See docs/modules/*.md for the exact entries each optional module needs.
export const cspAllowlist: CspDirectives = {};
