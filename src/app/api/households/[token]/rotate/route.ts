import { json, notFound, parseJsonBody, rejectCrossSite } from "@/lib/server/http";
import { rotateToken } from "@/lib/server/tracker";
import { limitTrackerWrites } from "@/lib/server/write-limit";
import { MAX_BODY_BYTES, todayOnlySchema } from "@/lib/tracker-schema";

// POST { today, recordedBy? } → new secret token; the old link stops working immediately.
export async function POST(req: Request, { params }: RouteContext<"/api/households/[token]/rotate">) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await limitTrackerWrites(req);
  if (limited) return limited;

  const body = await parseJsonBody(req, todayOnlySchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  const { token } = await params;
  const result = await rotateToken(token, body.data.today, body.data.recordedBy);
  if (result.kind === "not_found") return notFound();
  return json({ token: result.token });
}
