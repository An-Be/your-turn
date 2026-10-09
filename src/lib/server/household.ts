import "server-only";
import { db } from "./db";
import { isWellFormedToken } from "./token";
import type { TrackerData } from "@/lib/types";

export async function getTracker(token: string): Promise<TrackerData | null> {
  if (!isWellFormedToken(token)) return null;
  const h = await db.household.findUnique({
    where: { token },
    select: { id: true, token: true, playerAName: true, playerBName: true, currentStarter: true },
  });
  return h;
}
