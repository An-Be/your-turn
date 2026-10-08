import { undoTonight } from "@/lib/tracker";
import { isPlausibleToday, isValidDate, parseRecordedBy } from "@/lib/rules";
import { badRequest, json, notFound, rejectCrossSiteNoBody } from "@/lib/http";

// DELETE /nights/[date]?today=yyyy-mm-dd&by=A|B → undo tonight's record.
// Only tonight can be undone; past nights are corrected (M3), never deleted.
export async function DELETE(req: Request, { params }: { params: Promise<{ token: string; date: string }> }) {
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
