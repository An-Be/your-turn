import "server-only";
import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 2048;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const notFound = () => json({ error: "Not found" }, 404);
export const badRequest = (error: string) => json({ error }, 400);

/**
 * Same-origin JSON guard for mutating requests.
 * - Requires Content-Type: application/json, which forces a CORS preflight for any
 *   cross-site caller (blocks form/text-plain CSRF).
 * - If the browser sends Origin, it must match this host.
 */
export function rejectCrossSite(req: Request): NextResponse | null {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected application/json." }, 415);
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!host || originHost !== host) return json({ error: "Forbidden" }, 403);
  }
  return null;
}

/** Same-origin guard for DELETE (no body, so no Content-Type requirement). */
export function rejectCrossSiteNoBody(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return json({ error: "Forbidden" }, 403);
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (!host || new URL(origin).host !== host) return json({ error: "Forbidden" }, 403);
    } catch {
      return json({ error: "Forbidden" }, 403);
    }
  }
  return null;
}

/** Read a small JSON object body. Returns null on oversize or invalid JSON. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | "too_large" | null> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return "too_large";
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
