import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flip,
  isPlausibleToday,
  isValidDate,
  parseRecordedBy,
  planRecordTonight,
  planUndoTonight,
  type NightRecord,
} from "./rules.ts";

test("flip alternates players", () => {
  assert.equal(flip("A"), "B");
  assert.equal(flip("B"), "A");
});

test("isValidDate accepts real dates only", () => {
  assert.ok(isValidDate("2026-10-07"));
  assert.ok(isValidDate("2028-02-29"));
  for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "26-10-07", "2026-10-7", "", null, 20261007, "2026-10-07T00:00"]) {
    assert.equal(isValidDate(bad), false, String(bad));
  }
});

test("isPlausibleToday allows +/- one day from UTC", () => {
  const now = new Date("2026-10-08T02:00:00Z");
  assert.ok(isPlausibleToday("2026-10-07", now)); // Chicago evening
  assert.ok(isPlausibleToday("2026-10-08", now));
  assert.ok(isPlausibleToday("2026-10-09", now)); // Kiribati
  assert.equal(isPlausibleToday("2026-10-06", now), false);
  assert.equal(isPlausibleToday("2026-10-10", now), false);
  assert.equal(isPlausibleToday("not-a-date", now), false);
});

test("parseRecordedBy", () => {
  assert.deepEqual(parseRecordedBy(undefined), { ok: true, value: null });
  assert.deepEqual(parseRecordedBy(null), { ok: true, value: null });
  assert.deepEqual(parseRecordedBy("B"), { ok: true, value: "B" });
  assert.deepEqual(parseRecordedBy("C"), { ok: false });
  assert.deepEqual(parseRecordedBy(1), { ok: false });
});

test("Done flips, records tonight's starter", () => {
  const plan = planRecordTonight({ currentStarter: "A", existing: null, status: "DONE", recordedBy: "B" });
  assert.deepEqual(plan, {
    kind: "ok",
    night: { starter: "A", status: "DONE", appliedFlip: true, recordedBy: "B" },
    newStarter: "B",
  });
});

test("Skip keeps the same starter", () => {
  const plan = planRecordTonight({ currentStarter: "A", existing: null, status: "SKIPPED", recordedBy: null });
  assert.equal(plan.kind, "ok");
  if (plan.kind === "ok") {
    assert.equal(plan.newStarter, "A");
    assert.equal(plan.night.appliedFlip, false);
  }
});

test("second record for the same night is a conflict (no double flip)", () => {
  const existing: NightRecord = { date: "2026-10-07", starter: "A", status: "DONE", appliedFlip: true, recordedBy: "B" };
  const plan = planRecordTonight({ currentStarter: "B", existing, status: "DONE", recordedBy: "A" });
  assert.deepEqual(plan, { kind: "conflict", existing });
});

test("Undo after Done restores tonight's starter", () => {
  const night: NightRecord = { date: "2026-10-07", starter: "A", status: "DONE", appliedFlip: true, recordedBy: null };
  assert.deepEqual(planUndoTonight({ currentStarter: "B", night }), { kind: "ok", newStarter: "A" });
});

test("Undo after Skip changes nothing about the starter", () => {
  const night: NightRecord = { date: "2026-10-07", starter: "A", status: "SKIPPED", appliedFlip: false, recordedBy: null };
  assert.deepEqual(planUndoTonight({ currentStarter: "A", night }), { kind: "ok", newStarter: "A" });
});

test("Undo after Done then Swap reverses only its own flip", () => {
  // Done (A -> B), then Swap (B -> A). Undo reverses Done's flip only: A -> B.
  const night: NightRecord = { date: "2026-10-07", starter: "A", status: "DONE", appliedFlip: true, recordedBy: null };
  assert.deepEqual(planUndoTonight({ currentStarter: "A", night }), { kind: "ok", newStarter: "B" });
});

test("Undo with nothing recorded is a no-op", () => {
  assert.deepEqual(planUndoTonight({ currentStarter: "A", night: null }), { kind: "nothing" });
});

test("full week: done, skip, done, undo, done", () => {
  let starter: "A" | "B" = "A";
  const step = (status: "DONE" | "SKIPPED") => {
    const p = planRecordTonight({ currentStarter: starter, existing: null, status, recordedBy: null });
    if (p.kind !== "ok") throw new Error("unexpected conflict");
    const n = { date: "x", ...p.night };
    starter = p.newStarter;
    return n;
  };
  step("DONE"); // A started -> B next
  assert.equal(starter, "B");
  step("SKIPPED"); // B still next
  assert.equal(starter, "B");
  const n = step("DONE"); // B started -> A next
  assert.equal(n.starter, "B");
  assert.equal(starter, "A");
  const u = planUndoTonight({ currentStarter: starter, night: n });
  if (u.kind === "ok") starter = u.newStarter;
  assert.equal(starter, "B"); // back to B
});
