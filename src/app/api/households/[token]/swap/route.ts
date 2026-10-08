import { json, notFound, parseJsonBody, rejectCrossSite } from "@/lib/server/http";
import { swapStarter } from "@/lib/server/tracker";
import { limitTrackerWrites } from "@/lib/server/write-limit";
import { MAX_BODY_BYTES, todayOnlySchema } from "@/lib/tracker-schema";

// POST { today, recordedBy? } → flip the current starter without recording a night.
export async function POST(req: Request, { params }: RouteContext<"/api/households/[token]/swap">) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await limitTrackerWrites(req);
  if (limited) return limited;

  const body = await parseJsonBody(req, todayOnlySchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  const { token } = await params;
  const result = await swapStarter(token, body.data.today, body.data.recordedBy);
  if (result.kind === "not_found") return notFound();
  return json({ currentStarter: result.currentStarter });
}
