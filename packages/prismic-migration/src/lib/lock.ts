import { open, unlink } from "node:fs/promises";

/**
 * Thrown when a lock is already held. A distinct class (not a plain
 * Error) specifically so a caller can `instanceof`-check this exact
 * condition instead of matching on message text — the CLI and a non-CLI
 * caller (e.g. admin-app, where this fires just as often because a
 * second person legitimately clicked "Run" while the first is still
 * going, not because anything crashed) reasonably want to word this
 * differently for their own audience.
 */
export class LockConflictError extends Error {
  constructor(public readonly lockPath: string) {
    super(
      `Lock file already exists at ${lockPath}. If no other run is active, ` +
        `it was left behind by a crashed run — remove it manually before retrying.`,
    );
    this.name = "LockConflictError";
  }
}

/**
 * A simple exclusive lockfile, for local/manual runs only.
 *
 * This is NOT the primary concurrency guard for CI — a GitHub Actions
 * `concurrency:` group on the workflow that invokes this tool is (see
 * README, "Concurrency"). A committed lockfile can't safely arbitrate
 * between two fresh checkouts racing each other in CI; what it *does* do
 * is stop a second run on the same host (e.g. a developer running the CLI
 * twice by mistake, or a cron overlapping a manual run) from touching the
 * mapping file at the same time.
 */
export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  let handle;
  try {
    // 'wx' fails if the file already exists — the only atomic primitive
    // available here without a real distributed lock service.
    handle = await open(lockPath, "wx");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new LockConflictError(lockPath);
    }
    throw err;
  }

  try {
    await handle.writeFile(String(process.pid));
    return await fn();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => {
      // Already gone is fine — nothing else to clean up.
    });
  }
}
