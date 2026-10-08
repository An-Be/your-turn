import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isWellFormedToken, newToken } from "./token";
import {
  computeSplit,
  flip,
  planRecordTonight,
  planUndoTonight,
  retentionCutoff,
  windowStart,
  WINDOW_DAYS,
  type CorrectionPatch,
  type NightRecord,
  type NightStatus,
  type Player,
} from "./rules";

type Tx = Prisma.TransactionClient;

/** Activity types shown in history. DONE/SKIP/BACKFILL are already visible as nights. */
const VISIBLE_EVENT_TYPES = ["SWAP", "UNDO", "CORRECT", "ROTATE"] as const;
export type ActivityType = (typeof VISIBLE_EVENT_TYPES)[number];
export type Activity = { type: ActivityType; date: string; by: Player | null };

export type TrackerState = {
  householdId: string;
  playerAName: string;
  playerBName: string;
  currentStarter: Player;
  tonight: NightRecord | null;
  /** Nights in the 7-day window, newest first. Dates only, never times. */
  history: NightRecord[];
  /** Swaps, undos, corrections and rotations in the window, newest first. */
  activity: Activity[];
  /** DONE nights per starter in the window. */
  split: Record<Player, number>;
  windowDays: number;
};

/**
 * Lock the household row for the rest of the transaction so concurrent taps from
 * two phones are applied one after the other. Parameterized via Prisma's tagged template.
 */
async function lockHousehold(tx: Tx, token: string) {
  const rows = await tx.$queryRaw<{ id: string; currentStarter: Player }[]>`
    SELECT "id", "currentStarter"::text AS "currentStarter"
    FROM "Household"
    WHERE "token" = ${token}
    FOR UPDATE`;
  return rows[0] ?? null;
}

/** Delete this household's nights and activity that have left the retention window. */
async function purgeHousehold(tx: Tx, householdId: string) {
  const cutoff = retentionCutoff();
  const cutoffAt = new Date(Date.now() - (WINDOW_DAYS + 1) * 86_400_000);
  await tx.night.deleteMany({ where: { householdId, date: { lt: cutoff } } });
  await tx.event.deleteMany({ where: { householdId, at: { lt: cutoffAt } } });
}

/** Delete expired nights and activity for every household. Run daily by the cron route. */
export async function purgeAllExpired(now: Date = new Date()) {
  const cutoff = retentionCutoff(now);
  const cutoffAt = new Date(now.getTime() - (WINDOW_DAYS + 1) * 86_400_000);
  const [nights, events] = await db.$transaction([
    db.night.deleteMany({ where: { date: { lt: cutoff } } }),
    db.event.deleteMany({ where: { at: { lt: cutoffAt } } }),
  ]);
  return { nights: nights.count, events: events.count, cutoff };
}

const nightSelect = { date: true, starter: true, status: true, appliedFlip: true, recordedBy: true } as const;

function toRecord(n: { date: string; starter: Player; status: NightStatus; appliedFlip: boolean; recordedBy: Player | null }): NightRecord {
  return { date: n.date, starter: n.starter, status: n.status, appliedFlip: n.appliedFlip, recordedBy: n.recordedBy };
}

export async function getTrackerState(token: string, today: string): Promise<TrackerState | null> {
  if (!isWellFormedToken(token)) return null;
  const from = windowStart(today);
  const h = await db.household.findUnique({
    where: { token },
    select: {
      id: true,
      playerAName: true,
      playerBName: true,
      currentStarter: true,
      nights: {
        where: { date: { gte: from, lte: today } },
        select: nightSelect,
        orderBy: { date: "desc" },
      },
      events: {
        where: { date: { gte: from, lte: today }, type: { in: [...VISIBLE_EVENT_TYPES] } },
        select: { type: true, date: true, by: true },
        orderBy: { at: "desc" },
        take: 50,
      },
    },
  });
  if (!h) return null;
  const history = h.nights.map(toRecord);
  return {
    householdId: h.id,
    playerAName: h.playerAName,
    playerBName: h.playerBName,
    currentStarter: h.currentStarter,
    tonight: history.find((n) => n.date === today) ?? null,
    history,
    activity: h.events.map((e) => ({ type: e.type as ActivityType, date: e.date as string, by: e.by })),
    split: computeSplit(history),
    windowDays: WINDOW_DAYS,
  };
}

export type RecordResult =
  | { kind: "not_found" }
  | { kind: "conflict"; existing: NightRecord }
  | { kind: "ok"; currentStarter: Player; tonight: NightRecord };

export async function recordTonight(
  token: string,
  today: string,
  status: NightStatus,
  recordedBy: Player | null,
): Promise<RecordResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);

    const existingRow = await tx.night.findUnique({
      where: { householdId_date: { householdId: h.id, date: today } },
      select: nightSelect,
    });
    const plan = planRecordTonight({
      currentStarter: h.currentStarter,
      existing: existingRow ? toRecord(existingRow) : null,
      status,
      recordedBy,
    });
    if (plan.kind === "conflict") return { kind: "conflict", existing: plan.existing } as const;

    const night = await tx.night.create({
      data: { householdId: h.id, date: today, ...plan.night },
      select: nightSelect,
    });
    if (plan.newStarter !== h.currentStarter) {
      await tx.household.update({ where: { id: h.id }, data: { currentStarter: plan.newStarter } });
    }
    await tx.event.create({
      data: { householdId: h.id, type: status === "DONE" ? "DONE" : "SKIP", date: today, by: recordedBy },
    });
    return { kind: "ok", currentStarter: plan.newStarter, tonight: toRecord(night) } as const;
  });
}

export type BackfillResult = { kind: "not_found" } | { kind: "conflict"; existing: NightRecord } | { kind: "ok" };

/** Log a past night that was forgotten. Never changes the current starter. */
export async function backfillNight(
  token: string,
  date: string,
  starter: Player,
  status: NightStatus,
  recordedBy: Player | null,
): Promise<BackfillResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);

    const existing = await tx.night.findUnique({
      where: { householdId_date: { householdId: h.id, date } },
      select: nightSelect,
    });
    if (existing) return { kind: "conflict", existing: toRecord(existing) } as const;

    await tx.night.create({
      data: { householdId: h.id, date, starter, status, appliedFlip: false, recordedBy },
    });
    await tx.event.create({ data: { householdId: h.id, type: "BACKFILL", date, by: recordedBy } });
    return { kind: "ok" } as const;
  });
}

export type CorrectResult = { kind: "not_found" } | { kind: "missing" } | { kind: "ok"; night: NightRecord };

/** Correct a past night's record. Never changes the current starter (Swap does that). */
export async function correctNight(
  token: string,
  date: string,
  patch: CorrectionPatch,
  by: Player | null,
): Promise<CorrectResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);

    const where = { householdId_date: { householdId: h.id, date } };
    const existing = await tx.night.findUnique({ where, select: { id: true } });
    if (!existing) return { kind: "missing" } as const;

    const night = await tx.night.update({ where, data: patch, select: nightSelect });
    await tx.event.create({ data: { householdId: h.id, type: "CORRECT", date, by } });
    return { kind: "ok", night: toRecord(night) } as const;
  });
}

export type UndoResult = { kind: "not_found" } | { kind: "nothing" } | { kind: "ok"; currentStarter: Player };

export async function undoTonight(token: string, today: string, by: Player | null): Promise<UndoResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);

    const row = await tx.night.findUnique({
      where: { householdId_date: { householdId: h.id, date: today } },
      select: nightSelect,
    });
    const plan = planUndoTonight({ currentStarter: h.currentStarter, night: row ? toRecord(row) : null });
    if (plan.kind === "nothing") return { kind: "nothing" } as const;

    await tx.night.delete({ where: { householdId_date: { householdId: h.id, date: today } } });
    if (plan.newStarter !== h.currentStarter) {
      await tx.household.update({ where: { id: h.id }, data: { currentStarter: plan.newStarter } });
    }
    await tx.event.create({ data: { householdId: h.id, type: "UNDO", date: today, by } });
    return { kind: "ok", currentStarter: plan.newStarter } as const;
  });
}

export type SwapResult = { kind: "not_found" } | { kind: "ok"; currentStarter: Player };

export async function swapStarter(token: string, today: string, by: Player | null): Promise<SwapResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);
    const next = flip(h.currentStarter);
    await tx.household.update({ where: { id: h.id }, data: { currentStarter: next } });
    await tx.event.create({ data: { householdId: h.id, type: "SWAP", date: today, by } });
    return { kind: "ok", currentStarter: next } as const;
  });
}

export type RotateResult = { kind: "not_found" } | { kind: "ok"; token: string };

export async function rotateToken(token: string, today: string, by: Player | null): Promise<RotateResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    await purgeHousehold(tx, h.id);
    const fresh = newToken();
    await tx.household.update({ where: { id: h.id }, data: { token: fresh } });
    await tx.event.create({ data: { householdId: h.id, type: "ROTATE", date: today, by } });
    return { kind: "ok", token: fresh } as const;
  });
}
