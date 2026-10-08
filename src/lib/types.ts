export type Player = "A" | "B";

export type TrackerData = {
  id: string;
  token: string;
  playerAName: string;
  playerBName: string;
  currentStarter: Player;
};

export function nameFor(t: Pick<TrackerData, "playerAName" | "playerBName">, p: Player) {
  return p === "A" ? t.playerAName : t.playerBName;
}
