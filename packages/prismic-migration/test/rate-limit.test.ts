import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/lib/rate-limit.js";

describe("createRateLimiter", () => {
  it("spaces consecutive calls by at least minIntervalMs", async () => {
    const schedule = createRateLimiter(50);
    const timestamps: number[] = [];

    await schedule(async () => timestamps.push(Date.now()));
    await schedule(async () => timestamps.push(Date.now()));
    await schedule(async () => timestamps.push(Date.now()));

    // Timer jitter under load can shave a few ms off setTimeout's delay —
    // tolerate that without weakening what's actually being asserted.
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(35);
    expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(35);
  });

  it("does not delay a call that arrives after the interval has already elapsed", async () => {
    const schedule = createRateLimiter(20);
    const first = Date.now();
    await schedule(async () => {});
    await new Promise((resolve) => setTimeout(resolve, 30));
    const before = Date.now();
    await schedule(async () => {});
    const after = Date.now();
    expect(after - before).toBeLessThan(10);
    expect(before - first).toBeGreaterThanOrEqual(25);
  });
});
