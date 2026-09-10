import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withLock } from "./lock.js";

/**
 * Generic JSON-file-backed store. Used for both data/mapping.json and
 * data/asset-mapping.json — the plan calls for the same shape/logic for
 * both, so one class serves both.
 *
 * Every write goes through `mutate()`, which loads the current file inside
 * an exclusive lock, hands it to the callback, and atomically replaces the
 * file (write to a temp path, then `rename` — atomic on the same
 * filesystem, so a crash mid-write never leaves a half-written mapping
 * file behind). Plain reads don't need the lock.
 */
export class MappingStore<T extends Record<string, unknown>> {
  constructor(private readonly filePath: string) {}

  async load(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return {} as T;
      }
      throw err;
    }
  }

  async mutate(fn: (current: T) => T | Promise<T>): Promise<T> {
    const lockPath = `${this.filePath}.lock`;
    await mkdir(dirname(this.filePath), { recursive: true });

    return withLock(lockPath, async () => {
      const current = await this.load();
      const next = await fn(current);
      const tmpPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(tmpPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      await rename(tmpPath, this.filePath);
      return next;
    });
  }
}
