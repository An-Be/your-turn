import { isEditablePast, isPlausibleToday, isValidDate, parseRecordedBy, type CorrectionPatch } from "@/lib/rules";
import { badRequest, json, notFound, parseJsonBody, rejectCrossSite } from "@/lib/server/http";
import { correctNight, undoTonight } from "@/lib/server/tracker";
import { limitTrackerWrites } from "@/lib/server/write-limit";
import { correctNightSchema, MAX_BODY_BYTES } from "@/lib/tracker-schema";

type Ctx = RouteContext<"/api/households/[token]/nights/[date]">;

// PATCH { today, starter?, status?, recordedBy? } → correct a past night in the window.
// Corrections never change the current starter; Swap does that.
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await limitTrackerWrites(req);
  if (limited) return limited;

  const { token, date } = await params;
  if (!isValidDate(date)) return badRequest("Invalid date.");

  const body = await parseJsonBody(req, correctNightSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { today, starter, status, recordedBy } = body.data;
  if (!isEditablePast(date, today)) {
    return badRequest(date === today ? "Use Undo for today." : "Only the last 7 days can be corrected.");
  }

  const patch: CorrectionPatch = {};
  if (starter) patch.starter = starter;
  if (status) patch.status = status;

  const result = await correctNight(token, date, patch, recordedBy);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "missing") return json({ error: "That day isn't logged." }, 404);
  return json({ night: result.night });
}

// DELETE ?today=yyyy-mm-dd&by=A|B → undo tonight's record.
// Only tonight can be undone; past nights are corrected, never deleted by hand.
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSite(req, { hasBody: false });
  if (blocked) return blocked;
  const limited = await limitTrackerWrites(req);
  if (limited) return limited;

  const { token, date } = await params;
  const sp = new URL(req.url).searchParams;
  const today = sp.get("today") ?? "";
  if (!isValidDate(date) || !isPlausibleToday(today)) return badRequest("Invalid date.");
  if (date !== today) return badRequest("Only today can be undone.");
  const by = parseRecordedBy(sp.get("by") ?? undefined);
  if (!by.ok) return badRequest("Invalid by.");

  const result = await undoTonight(token, date, by.value);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "nothing") return json({ error: "Nothing to undo." }, 409);
  return json({ currentStarter: result.currentStarter, tonight: null });
}
