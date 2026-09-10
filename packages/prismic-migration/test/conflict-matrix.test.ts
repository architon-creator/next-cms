import { describe, expect, it } from "vitest";
import { classifySync } from "../src/phases/phase4-backsync.js";
import type { MappingEntry } from "../src/types.js";

function entry(overrides: Partial<MappingEntry> = {}): MappingEntry {
  return {
    sit_id: "sit-1",
    doc_type: "homepage",
    dev_hash: "dev-hash-v1",
    sit_hash: "sit-hash-v1",
    last_synced_at: "2026-01-01T00:00:00.000Z",
    last_synced_direction: "dev->sit",
    status: "synced",
    ...overrides,
  };
}

describe("classifySync — the 4-quadrant back-sync conflict matrix", () => {
  it("dev unchanged, sit unchanged -> noop", () => {
    const e = entry();
    expect(classifySync(e, e.dev_hash, e.sit_hash)).toBe("noop");
  });

  it("dev unchanged, sit changed -> fast-forward sync sit -> dev", () => {
    const e = entry();
    expect(classifySync(e, e.dev_hash, "sit-hash-v2")).toBe("sync-sit-to-dev");
  });

  it("dev changed, sit unchanged -> pending forward-sync, not a conflict", () => {
    const e = entry();
    expect(classifySync(e, "dev-hash-v2", e.sit_hash)).toBe("pending-dev-to-sit");
  });

  it("dev changed, sit changed -> conflict", () => {
    const e = entry();
    expect(classifySync(e, "dev-hash-v2", "sit-hash-v2")).toBe("conflict");
  });
});
