import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isWellFormedToken, newToken } from "./token";
import {
  flip,
  planRecordTonight,
  planUndoTonight,
  type NightRecord,
  type NightStatus,
  type Player,
} from "./rules";

type Tx = Prisma.TransactionClient;

export type TonightState = {
  householdId: string;
  playerAName: string;
  playerBName: string;
  currentStarter: Player;
  tonight: NightRecord | null;
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

const nightSelect = { date: true, starter: true, status: true, appliedFlip: true, recordedBy: true } as const;

function toRecord(n: { date: string; starter: Player; status: NightStatus; appliedFlip: boolean; recordedBy: Player | null }): NightRecord {
  return { date: n.date, starter: n.starter, status: n.status, appliedFlip: n.appliedFlip, recordedBy: n.recordedBy };
}

export async function getTonightState(token: string, today: string): Promise<TonightState | null> {
  if (!isWellFormedToken(token)) return null;
  const h = await db.household.findUnique({
    where: { token },
    select: {
      id: true,
      playerAName: true,
      playerBName: true,
      currentStarter: true,
      nights: { where: { date: today }, select: nightSelect, take: 1 },
    },
  });
  if (!h) return null;
  return {
    householdId: h.id,
    playerAName: h.playerAName,
    playerBName: h.playerBName,
    currentStarter: h.currentStarter,
    tonight: h.nights[0] ? toRecord(h.nights[0]) : null,
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

export type UndoResult = { kind: "not_found" } | { kind: "nothing" } | { kind: "ok"; currentStarter: Player };

export async function undoTonight(token: string, today: string, by: Player | null): Promise<UndoResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;

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
    const next = flip(h.currentStarter);
    await tx.household.update({ where: { id: h.id }, data: { currentStarter: next } });
    await tx.event.create({ data: { householdId: h.id, type: "SWAP", date: today, by } });
    return { kind: "ok", currentStarter: next } as const;
  });
}

export type RotateResult = { kind: "not_found" } | { kind: "ok"; token: string };

export async function rotateToken(token: string, by: Player | null): Promise<RotateResult> {
  if (!isWellFormedToken(token)) return { kind: "not_found" };
  return db.$transaction(async (tx) => {
    const h = await lockHousehold(tx, token);
    if (!h) return { kind: "not_found" } as const;
    const fresh = newToken();
    await tx.household.update({ where: { id: h.id }, data: { token: fresh } });
    await tx.event.create({ data: { householdId: h.id, type: "ROTATE", by } });
    return { kind: "ok", token: fresh } as const;
  });
}
