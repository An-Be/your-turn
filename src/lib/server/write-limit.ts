import "server-only";
import { getClientIp } from "./client-ip";
import { tooManyRequests } from "./http";
import { checkRateLimit } from "./rate-limit";

/**
 * Generous per-IP cap on tracker writes (Done, Skip, Swap, Undo, corrections,
 * rotate). Two people tapping normally never get near it; it stops a buggy
 * retry loop or a script from flooding the activity log.
 */
export async function limitTrackerWrites(req: Request) {
  const limit = await checkRateLimit(`tracker:write:${getClientIp(req)}`, { limit: 120, windowSeconds: 600 });
  return limit.allowed ? null : tooManyRequests(limit.retryAfterSeconds);
}
