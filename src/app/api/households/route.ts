import { getClientIp } from "@/lib/server/client-ip";
import { db } from "@/lib/server/db";
import { json, parseJsonBody, rejectCrossSite, tooManyRequests } from "@/lib/server/http";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { newToken } from "@/lib/server/token";
import { createHouseholdSchema, MAX_BODY_BYTES } from "@/lib/tracker-schema";

// POST { playerAName, playerBName, starter } → { token, url }
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const limit = await checkRateLimit(`household:create:${getClientIp(req)}`, { limit: 20, windowSeconds: 3600 });
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const body = await parseJsonBody(req, createHouseholdSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { playerAName, playerBName, starter } = body.data;

  const token = newToken();
  await db.household.create({
    data: { token, playerAName, playerBName, currentStarter: starter },
  });

  const origin = new URL(req.url).origin;
  return json({ token, url: `${origin}/t/${token}` }, 201);
}
