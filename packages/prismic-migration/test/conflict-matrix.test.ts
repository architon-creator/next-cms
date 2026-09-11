import { describe, expect, it } from "vitest";
import { classifySync } from "../src/phases/phase4-backsync.js";
import type { MappingEntry } from "../src/types.js";

function entry(overrides: Partial<MappingEntry> = {}): MappingEntry {
  return {
    upper_id: "upper-1",
    doc_type: "homepage",
    lower_hash: "lower-hash-v1",
    upper_hash: "upper-hash-v1",
    last_synced_at: "2026-01-01T00:00:00.000Z",
    last_synced_direction: "forward",
    status: "synced",
    ...overrides,
  };
}

describe("classifySync — the 4-quadrant back-sync conflict matrix", () => {
  it("lower unchanged, upper unchanged -> noop", () => {
    const e = entry();
    expect(classifySync(e, e.lower_hash, e.upper_hash)).toBe("noop");
  });

  it("lower unchanged, upper changed -> fast-forward sync upper -> lower", () => {
    const e = entry();
    expect(classifySync(e, e.lower_hash, "upper-hash-v2")).toBe("sync-upper-to-lower");
  });

  it("lower changed, upper unchanged -> pending forward-sync, not a conflict", () => {
    const e = entry();
    expect(classifySync(e, "lower-hash-v2", e.upper_hash)).toBe("pending-lower-to-upper");
  });

  it("lower changed, upper changed -> conflict", () => {
    const e = entry();
    expect(classifySync(e, "lower-hash-v2", "upper-hash-v2")).toBe("conflict");
  });
});
