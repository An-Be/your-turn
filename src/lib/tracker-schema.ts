import { z } from "zod";
import { isPlausibleToday, isPlayer, isValidDate, type Player } from "./rules";

// Request schemas for the household API. Pure (no server imports) so forms can
// share the limits. Key order matters: parseJsonBody reports the first failing
// field, so keys are listed in the order the old hand-written checks ran.

export const NAME_MAX = 24;
/** Request bodies are tiny; anything bigger is a mistake or abuse. */
export const MAX_BODY_BYTES = 2048;

const NAME_ERROR = `Both names are required (${NAME_MAX} characters max).`;

/** Trim, collapse inner whitespace, 1 to 24 characters. */
export const playerName = z
  .string({ error: NAME_ERROR })
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, NAME_ERROR).max(NAME_MAX, NAME_ERROR));

const player = z.enum(["A", "B"]);

/** The client's local calendar date; must be within a day of UTC. */
export const today = z.string({ error: "Invalid date." }).refine((t) => isPlausibleToday(t), "Invalid date.");

const date = z.string({ error: "Invalid date." }).refine((d) => isValidDate(d), "Invalid date.");

/** Optional attribution: "A" | "B" | null | missing. */
const recordedBy = z
  .union([player, z.null()], { error: "Invalid recordedBy." })
  .optional()
  .transform((v): Player | null => v ?? null);

export const createHouseholdSchema = z.object({
  playerAName: playerName,
  playerBName: playerName,
  // Lenient on purpose: anything but "B" starts with A.
  starter: z.unknown().optional().transform((v): Player => (v === "B" ? "B" : "A")),
});

export const recordNightSchema = z.object({
  date,
  today,
  status: z.enum(["DONE", "SKIPPED"], { error: "Invalid status." }),
  recordedBy,
  // Only used (and required) for a backfilled past night, checked in the route.
  // Ignored for tonight, so a bad value is dropped rather than rejected here.
  starter: z.unknown().optional().transform((v): Player | undefined => (isPlayer(v) ? v : undefined)),
});

export const correctNightSchema = z
  .object({
    today,
    starter: z.enum(["A", "B"], { error: "Nothing valid to change." }).optional(),
    status: z.enum(["DONE", "SKIPPED"], { error: "Nothing valid to change." }).optional(),
    recordedBy,
  })
  .refine((b) => b.starter !== undefined || b.status !== undefined, "Nothing valid to change.");

export const todayOnlySchema = z.object({ today, recordedBy });
