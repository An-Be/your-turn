import { NextResponse } from "next/server";
import { getTracker } from "@/lib/household";

// M1: tonight's starter + names. History and 30-day split land in M3.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tracker = await getTracker(token);
  if (!tracker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, playerAName, playerBName, currentStarter } = tracker;
  return NextResponse.json({ id, playerAName, playerBName, currentStarter });
}
