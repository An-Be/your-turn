import { isEditablePast } from "@/lib/rules";
import { badRequest, json, notFound, parseJsonBody, rejectCrossSite } from "@/lib/server/http";
import { backfillNight, recordTonight } from "@/lib/server/tracker";
import { limitTrackerWrites } from "@/lib/server/write-limit";
import { MAX_BODY_BYTES, recordNightSchema } from "@/lib/tracker-schema";

// POST { date, today, status: "DONE" | "SKIPPED", starter?, recordedBy? }
// - date === today: record tonight (Done flips the starter, Skip doesn't).
// - date in the last 6 days: backfill a forgotten night; `starter` required; never flips.
export async function POST(req: Request, { params }: RouteContext<"/api/households/[token]/nights">) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await limitTrackerWrites(req);
  if (limited) return limited;

  const body = await parseJsonBody(req, recordNightSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { date, today, status, recordedBy, starter } = body.data;
  const { token } = await params;

  if (date === today) {
    const result = await recordTonight(token, date, status, recordedBy);
    if (result.kind === "not_found") return notFound();
    if (result.kind === "conflict") {
      return json({ error: "Today is already logged.", existing: result.existing }, 409);
    }
    return json({ currentStarter: result.currentStarter, tonight: result.tonight }, 201);
  }

  if (!isEditablePast(date, today)) return badRequest("Only the last 7 days can be logged.");
  if (!starter) return badRequest("Say who started that night.");

  const result = await backfillNight(token, date, starter, status, recordedBy);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "conflict") {
    return json({ error: "That day is already logged.", existing: result.existing }, 409);
  }
  return json({ ok: true }, 201);
}
