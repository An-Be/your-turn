import "server-only";
import { db } from "./db";
import { isWellFormedToken } from "./token";
import type { TrackerData } from "./types";

export async function getTracker(token: string): Promise<TrackerData | null> {
  if (!isWellFormedToken(token)) return null;
  const h = await db.household.findUnique({
    where: { token },
    select: { id: true, token: true, playerAName: true, playerBName: true, currentStarter: true },
  });
  return h;
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length >= 1 && s.length <= 24 ? s : null;
}
