import { rotateToken } from "@/lib/tracker";
import { parseRecordedBy } from "@/lib/rules";
import { badRequest, json, notFound, readJsonBody, rejectCrossSite } from "@/lib/http";

// POST { recordedBy? } → new secret token; the old link stops working immediately.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (body === "too_large") return json({ error: "Request too large." }, 413);
  if (!body) return badRequest("Invalid JSON.");
  const by = parseRecordedBy(body.recordedBy);
  if (!by.ok) return badRequest("Invalid recordedBy.");

  const { token } = await params;
  const result = await rotateToken(token, by.value);
  if (result.kind === "not_found") return notFound();
  return json({ token: result.token });
}
