// Pure turn-taking rules. No I/O, no Prisma, so they can be unit tested directly.

export type Player = "A" | "B";
export type NightStatus = "DONE" | "SKIPPED";

export type NightRecord = {
  date: string;
  starter: Player;
  status: NightStatus;
  appliedFlip: boolean;
  recordedBy: Player | null;
};

export const flip = (p: Player): Player => (p === "A" ? "B" : "A");

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict yyyy-mm-dd that is a real calendar date (rejects 2026-02-30). */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isPlayer(v: unknown): v is Player {
  return v === "A" || v === "B";
}

/** Optional attribution: "A" | "B" | null. Anything else is invalid. */
export function parseRecordedBy(v: unknown): { ok: true; value: Player | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, value: null };
  return isPlayer(v) ? { ok: true, value: v } : { ok: false };
}

function dayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * The client sends its local calendar date as "today". Every real timezone is
 * within one day of UTC, so anything further off is a bad clock or a forged value.
 */
export function isPlausibleToday(today: string, now: Date = new Date()): boolean {
  if (!isValidDate(today)) return false;
  const utc = now.toISOString().slice(0, 10);
  return Math.abs(dayNumber(today) - dayNumber(utc)) <= 1;
}

export type RecordTonightPlan =
  | { kind: "conflict"; existing: NightRecord }
  | {
      kind: "ok";
      night: Omit<NightRecord, "date">;
      newStarter: Player;
    };

/** Record tonight. DONE flips the starter; SKIPPED keeps it. A second record for the same date is a conflict. */
export function planRecordTonight(input: {
  currentStarter: Player;
  existing: NightRecord | null;
  status: NightStatus;
  recordedBy: Player | null;
}): RecordTonightPlan {
  if (input.existing) return { kind: "conflict", existing: input.existing };
  const done = input.status === "DONE";
  return {
    kind: "ok",
    night: {
      starter: input.currentStarter,
      status: input.status,
      appliedFlip: done,
      recordedBy: input.recordedBy,
    },
    newStarter: done ? flip(input.currentStarter) : input.currentStarter,
  };
}

export type UndoPlan = { kind: "nothing" } | { kind: "ok"; newStarter: Player };

/** Undo tonight: remove the record and reverse only the flip that record made. */
export function planUndoTonight(input: { currentStarter: Player; night: NightRecord | null }): UndoPlan {
  if (!input.night) return { kind: "nothing" };
  return {
    kind: "ok",
    newStarter: input.night.appliedFlip ? flip(input.currentStarter) : input.currentStarter,
  };
}
