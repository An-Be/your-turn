import { recordTonight } from "@/lib/tracker";
import { isPlausibleToday, isValidDate, parseRecordedBy } from "@/lib/rules";
import { badRequest, json, notFound, readJsonBody, rejectCrossSite } from "@/lib/http";

// POST { date, today, status: "DONE" | "SKIPPED", recordedBy? }
// M2 records tonight only (date === today). Backfill of past nights lands in M3.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (body === "too_large") return json({ error: "Request too large." }, 413);
  if (!body) return badRequest("Invalid JSON.");

  const { date, today, status } = body;
  if (!isValidDate(date) || !isPlausibleToday(today as string)) return badRequest("Invalid date.");
  if (date !== today) return badRequest("Only tonight can be recorded right now.");
  if (status !== "DONE" && status !== "SKIPPED") return badRequest("Invalid status.");
  const by = parseRecordedBy(body.recordedBy);
  if (!by.ok) return badRequest("Invalid recordedBy.");

  const { token } = await params;
  const result = await recordTonight(token, date, status, by.value);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "conflict") {
    return json({ error: "Tonight is already logged.", existing: result.existing }, 409);
  }
  return json({ currentStarter: result.currentStarter, tonight: result.tonight }, 201);
}
