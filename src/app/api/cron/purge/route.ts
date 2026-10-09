import { timingSafeEqual } from "node:crypto";
import { purgeAllExpired } from "@/lib/server/tracker";

// Daily retention job (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
// Deletes every night and activity entry that has left the 7-day window.
export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await purgeAllExpired();
  console.log(`[purge] cutoff=${result.cutoff} nights=${result.nights} events=${result.events}`);
  return Response.json(result);
}
