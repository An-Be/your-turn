import { db } from "@/lib/db";
import { newToken } from "@/lib/token";
import { cleanName } from "@/lib/household";
import { badRequest, json, readJsonBody, rejectCrossSite } from "@/lib/http";

// POST { playerAName, playerBName, starter } → { token, url }
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (body === "too_large") return json({ error: "Request too large." }, 413);
  if (!body) return badRequest("Invalid JSON.");

  const a = cleanName(body.playerAName);
  const b = cleanName(body.playerBName);
  const starter = body.starter === "B" ? "B" : "A";
  if (!a || !b) return badRequest("Both names are required (24 characters max).");

  const token = newToken();
  await db.household.create({
    data: { token, playerAName: a, playerBName: b, currentStarter: starter },
  });

  const origin = new URL(req.url).origin;
  return json({ token, url: `${origin}/t/${token}` }, 201);
}
