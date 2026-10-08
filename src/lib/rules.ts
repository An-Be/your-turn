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

// ---- 7-day window (M3) ----

/** Number of calendar days in the fairness window and history, including today. */
export const WINDOW_DAYS = 7;

/** yyyy-mm-dd shifted by n days (UTC arithmetic on a calendar date, no timezone involved). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** First date inside the window that ends on `today` (inclusive). */
export function windowStart(today: string): string {
  return addDays(today, -(WINDOW_DAYS - 1));
}

export function isInWindow(date: string, today: string): boolean {
  return date >= windowStart(today) && date <= today;
}

/** A past night inside the window: can be backfilled or corrected. Tonight uses Done/Skip/Undo instead. */
export function isEditablePast(date: string, today: string): boolean {
  return date < today && date >= windowStart(today);
}

/**
 * Server-side retention cutoff. Nights dated before this are deleted.
 * Clients can be up to one day ahead of UTC, so keep one extra day so no client
 * ever loses a night that is still inside its own 7-day window.
 */
export function retentionCutoff(now: Date = new Date()): string {
  const utcToday = now.toISOString().slice(0, 10);
  return addDays(utcToday, -WINDOW_DAYS);
}

/** DONE nights per starter. Skipped nights don't count for anyone. */
export function computeSplit(nights: Pick<NightRecord, "starter" | "status">[]): Record<Player, number> {
  const split: Record<Player, number> = { A: 0, B: 0 };
  for (const n of nights) if (n.status === "DONE") split[n.starter] += 1;
  return split;
}

export type CorrectionPatch = { starter?: Player; status?: NightStatus };

/** Validate a correction body. At least one field, each one valid. */
export function parseCorrection(body: Record<string, unknown>): { ok: true; patch: CorrectionPatch } | { ok: false } {
  const patch: CorrectionPatch = {};
  if (body.starter !== undefined) {
    if (!isPlayer(body.starter)) return { ok: false };
    patch.starter = body.starter;
  }
  if (body.status !== undefined) {
    if (body.status !== "DONE" && body.status !== "SKIPPED") return { ok: false };
    patch.status = body.status;
  }
  return Object.keys(patch).length > 0 ? { ok: true, patch } : { ok: false };
}
