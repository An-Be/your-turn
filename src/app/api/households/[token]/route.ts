import { getTonightState } from "@/lib/tracker";
import { isPlausibleToday } from "@/lib/rules";
import { badRequest, json, notFound } from "@/lib/http";

// GET ?today=yyyy-mm-dd → names, current starter, tonight's record (if any).
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const today = new URL(req.url).searchParams.get("today") ?? "";
  if (!isPlausibleToday(today)) return badRequest("Invalid date.");

  const state = await getTonightState(token, today);
  if (!state) return notFound();

  const { householdId: _id, ...publicState } = state;
  return json(publicState);
}
