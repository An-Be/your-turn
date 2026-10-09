import { describe, expect, it } from "vitest";
import { correctNightSchema, createHouseholdSchema, recordNightSchema, todayOnlySchema } from "./tracker-schema";

const today = new Date().toISOString().slice(0, 10);
const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("createHouseholdSchema", () => {
  it("cleans names and defaults the starter to A", () => {
    expect(createHouseholdSchema.parse({ playerAName: "  Andrea ", playerBName: "Marta   L" })).toEqual({
      playerAName: "Andrea",
      playerBName: "Marta L",
      starter: "A",
    });
  });

  it("keeps B as starter and treats anything else as A", () => {
    expect(createHouseholdSchema.parse({ playerAName: "a", playerBName: "b", starter: "B" }).starter).toBe("B");
    expect(createHouseholdSchema.parse({ playerAName: "a", playerBName: "b", starter: "Z" }).starter).toBe("A");
  });

  it("rejects missing, blank or long names with one message", () => {
    for (const body of [{ playerAName: "a" }, { playerAName: " ", playerBName: "b" }, { playerAName: "x".repeat(25), playerBName: "b" }]) {
      expect(firstMessage(createHouseholdSchema.safeParse(body))).toBe("Both names are required (24 characters max).");
    }
  });
});

describe("recordNightSchema", () => {
  it("accepts tonight and nulls a missing recordedBy", () => {
    expect(recordNightSchema.parse({ date: today, today, status: "DONE" })).toEqual({
      date: today,
      today,
      status: "DONE",
      recordedBy: null,
      starter: undefined,
    });
  });

  it("reports the first bad field in the old order", () => {
    expect(firstMessage(recordNightSchema.safeParse({ date: "2026-02-30", today, status: "NOPE" }))).toBe("Invalid date.");
    expect(firstMessage(recordNightSchema.safeParse({ date: today, today: "1999-01-01", status: "DONE" }))).toBe("Invalid date.");
    expect(firstMessage(recordNightSchema.safeParse({ date: today, today, status: "NOPE" }))).toBe("Invalid status.");
    expect(firstMessage(recordNightSchema.safeParse({ date: today, today, status: "DONE", recordedBy: "C" }))).toBe(
      "Invalid recordedBy.",
    );
  });

  it("drops an invalid starter instead of rejecting (the route decides if it's required)", () => {
    expect(recordNightSchema.parse({ date: today, today, status: "DONE", starter: "C" }).starter).toBeUndefined();
    expect(recordNightSchema.parse({ date: today, today, status: "DONE", starter: "B" }).starter).toBe("B");
  });
});

describe("correctNightSchema", () => {
  it("needs at least one valid change", () => {
    expect(firstMessage(correctNightSchema.safeParse({ today }))).toBe("Nothing valid to change.");
    expect(firstMessage(correctNightSchema.safeParse({ today, starter: "C" }))).toBe("Nothing valid to change.");
    expect(firstMessage(correctNightSchema.safeParse({ today, status: "LATE" }))).toBe("Nothing valid to change.");
    expect(correctNightSchema.parse({ today, status: "SKIPPED" })).toEqual({ today, status: "SKIPPED", recordedBy: null });
  });
});

describe("todayOnlySchema", () => {
  it("validates today and attribution", () => {
    expect(todayOnlySchema.parse({ today, recordedBy: "A" })).toEqual({ today, recordedBy: "A" });
    expect(firstMessage(todayOnlySchema.safeParse({}))).toBe("Invalid date.");
  });
});
