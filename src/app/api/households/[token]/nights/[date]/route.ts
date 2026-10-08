import { correctNight, undoTonight } from "@/lib/tracker";
import { isEditablePast, isPlausibleToday, isValidDate, parseCorrection, parseRecordedBy } from "@/lib/rules";
import { badRequest, json, notFound, readJsonBody, rejectCrossSite, rejectCrossSiteNoBody } from "@/lib/http";

type Ctx = { params: Promise<{ token: string; date: string }> };

// PATCH { today, starter?, status?, recordedBy? } → correct a past night in the window.
// Corrections never change the current starter; Swap does that.
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (body === "too_large") return json({ error: "Request too large." }, 413);
  if (!body) return badRequest("Invalid JSON.");

  const { token, date } = await params;
  const today = body.today as string;
  if (!isValidDate(date) || !isPlausibleToday(today)) return badRequest("Invalid date.");
  if (!isEditablePast(date, today)) {
    return badRequest(date === today ? "Use Undo for tonight." : "Only the last 7 days can be corrected.");
  }
  const parsed = parseCorrection(body);
  if (!parsed.ok) return badRequest("Nothing valid to change.");
  const by = parseRecordedBy(body.recordedBy);
  if (!by.ok) return badRequest("Invalid recordedBy.");

  const result = await correctNight(token, date, parsed.patch, by.value);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "missing") return json({ error: "That night isn't logged." }, 404);
  return json({ night: result.night });
}

// DELETE ?today=yyyy-mm-dd&by=A|B → undo tonight's record.
// Only tonight can be undone; past nights are corrected, never deleted by hand.
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSiteNoBody(req);
  if (blocked) return blocked;

  const { token, date } = await params;
  const sp = new URL(req.url).searchParams;
  const today = sp.get("today") ?? "";
  if (!isValidDate(date) || !isPlausibleToday(today)) return badRequest("Invalid date.");
  if (date !== today) return badRequest("Only tonight can be undone.");
  const by = parseRecordedBy(sp.get("by") ?? undefined);
  if (!by.ok) return badRequest("Invalid by.");

  const result = await undoTonight(token, date, by.value);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "nothing") return json({ error: "Nothing to undo." }, 409);
  return json({ currentStarter: result.currentStarter, tonight: null });
}
