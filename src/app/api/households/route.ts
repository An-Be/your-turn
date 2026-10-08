import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newToken } from "@/lib/token";
import { cleanName } from "@/lib/household";

const MAX_BODY_BYTES = 2048;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  let body: { playerAName?: unknown; playerBName?: unknown; starter?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const a = cleanName(body?.playerAName);
  const b = cleanName(body?.playerBName);
  const starter = body?.starter === "B" ? "B" : "A";

  if (!a || !b) {
    return NextResponse.json({ error: "Both names are required (24 characters max)." }, { status: 400 });
  }

  const token = newToken();
  await db.household.create({
    data: { token, playerAName: a, playerBName: b, currentStarter: starter },
  });

  const origin = new URL(req.url).origin;
  return NextResponse.json({ token, url: `${origin}/t/${token}` }, { status: 201 });
}
