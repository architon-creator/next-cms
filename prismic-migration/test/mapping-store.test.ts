import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MappingStore } from "../src/lib/mapping-store.js";

describe("MappingStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mapping-store-"));
    filePath = join(dir, "mapping.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("load() returns {} when the file doesn't exist yet", async () => {
    const store = new MappingStore(filePath);
    await expect(store.load()).resolves.toEqual({});
  });

  it("mutate() creates the file and persists the callback's return value", async () => {
    const store = new MappingStore<Record<string, number>>(filePath);
    await store.mutate((current) => ({ ...current, a: 1 }));
    await expect(store.load()).resolves.toEqual({ a: 1 });
  });

  it("mutate() hands the callback the current on-disk state", async () => {
    const store = new MappingStore<Record<string, number>>(filePath);
    await store.mutate(() => ({ a: 1 }));
    await store.mutate((current) => ({ ...current, b: 2 }));
    await expect(store.load()).resolves.toEqual({ a: 1, b: 2 });
  });

  it("never leaves a lockfile behind after a successful mutate", async () => {
    const store = new MappingStore<Record<string, number>>(filePath);
    await store.mutate((current) => ({ ...current, a: 1 }));
    // A second mutate would fail if the lock from the first wasn't released.
    await expect(store.mutate((current) => ({ ...current, b: 2 }))).resolves.toEqual({
      a: 1,
      b: 2,
    });
  });

  it("rejects a concurrent mutate while one is already holding the lock", async () => {
    const store = new MappingStore<Record<string, number>>(filePath);
    const first = store.mutate(async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ...current, a: 1 };
    });
    // Give the first call time to acquire the lock before the second tries.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(store.mutate((current) => ({ ...current, b: 2 }))).rejects.toThrow(
      /Lock file already exists/,
    );
    await first;
  });
});
