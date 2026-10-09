import { describe, expect, it } from "vitest";
import { parseSavedTracker } from "./saved-tracker";

const ok = { token: "4JdAlcg30zoScSY6C2bTBA", playerAName: "Andrea", playerBName: "Sabrina" };

describe("parseSavedTracker", () => {
  it("reads a valid saved tracker", () => {
    expect(parseSavedTracker(JSON.stringify(ok))).toEqual(ok);
  });

  it("ignores empty, junk and malformed values", () => {
    for (const raw of [null, "", "nope", "null", "[]", "{}"]) expect(parseSavedTracker(raw)).toBeNull();
  });

  it("rejects tokens that aren't secret-link shaped", () => {
    for (const token of ["short", "../../etc/passwd0000", "javascript:alert(1)0000", 42]) {
      expect(parseSavedTracker(JSON.stringify({ ...ok, token }))).toBeNull();
    }
  });

  it("requires both names and caps their length", () => {
    expect(parseSavedTracker(JSON.stringify({ token: ok.token, playerAName: "A" }))).toBeNull();
    expect(parseSavedTracker(JSON.stringify({ ...ok, playerAName: "x".repeat(100) }))?.playerAName).toHaveLength(24);
  });
});
