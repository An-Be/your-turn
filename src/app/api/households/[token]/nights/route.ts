import { backfillNight, recordTonight } from "@/lib/tracker";
import { isEditablePast, isPlausibleToday, isPlayer, isValidDate, parseRecordedBy } from "@/lib/rules";
import { badRequest, json, notFound, readJsonBody, rejectCrossSite } from "@/lib/http";

// POST { date, today, status: "DONE" | "SKIPPED", starter?, recordedBy? }
// - date === today: record tonight (Done flips the starter, Skip doesn't).
// - date in the last 6 days: backfill a forgotten night; `starter` required; never flips.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (body === "too_large") return json({ error: "Request too large." }, 413);
  if (!body) return badRequest("Invalid JSON.");

  const { date, today, status } = body;
  if (!isValidDate(date) || !isPlausibleToday(today as string)) return badRequest("Invalid date.");
  if (status !== "DONE" && status !== "SKIPPED") return badRequest("Invalid status.");
  const by = parseRecordedBy(body.recordedBy);
  if (!by.ok) return badRequest("Invalid recordedBy.");
  const { token } = await params;

  if (date === today) {
    const result = await recordTonight(token, date, status, by.value);
    if (result.kind === "not_found") return notFound();
    if (result.kind === "conflict") {
      return json({ error: "Today is already logged.", existing: result.existing }, 409);
    }
    return json({ currentStarter: result.currentStarter, tonight: result.tonight }, 201);
  }

  if (!isEditablePast(date, today as string)) return badRequest("Only the last 7 days can be logged.");
  if (!isPlayer(body.starter)) return badRequest("Say who started that night.");

  const result = await backfillNight(token, date, body.starter, status, by.value);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "conflict") {
    return json({ error: "That day is already logged.", existing: result.existing }, 409);
  }
  return json({ ok: true }, 201);
}
