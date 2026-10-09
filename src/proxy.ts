import { NextResponse, type NextRequest } from "next/server";
import { cspAllowlist } from "@/config/csp";
import { buildCsp, newNonce } from "@/lib/csp";

// Next 16 renamed middleware.ts to proxy.ts. Runs on the Node runtime.
//
// Sets a strict, nonce-based Content-Security-Policy on every page request.
// Next reads the nonce from the request's CSP header and tags its own scripts.
// This must stay the ONLY Content-Security-Policy header on the response: a
// second, nonce-less one (e.g. from next.config.ts) would leave Next's scripts
// untagged and blank the page.
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development", cspAllowlist);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
