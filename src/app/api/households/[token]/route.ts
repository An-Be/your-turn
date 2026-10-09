import { isPlausibleToday } from "@/lib/rules";
import { badRequest, json, notFound } from "@/lib/server/http";
import { getTrackerState } from "@/lib/server/tracker";

// GET ?today=yyyy-mm-dd → names, current starter, tonight, last 7 days of history, 7-day split.
export async function GET(req: Request, { params }: RouteContext<"/api/households/[token]">) {
  const { token } = await params;
  const today = new URL(req.url).searchParams.get("today") ?? "";
  if (!isPlausibleToday(today)) return badRequest("Invalid date.");

  const state = await getTrackerState(token, today);
  if (!state) return notFound();

  // Never send the internal id to the client.
  const { householdId: _householdId, ...publicState } = state;
  return json(publicState);
}
