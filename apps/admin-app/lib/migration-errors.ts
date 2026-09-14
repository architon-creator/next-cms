import { LockConflictError, PrismicApiError } from "prismic-migration/actions";

export type MigrationErrorPayload = {
  message: string;
  status?: number;
  body?: string;
  kind?: "lock_conflict";
};

/**
 * Builds the payload sent as the SSE "error" event's data, across all
 * four migration routes. Two things the CLI's own top-level handler
 * already gets right that a plain `err.message` loses:
 *
 * - PrismicApiError's status/body: Prismic's 4xx responses are JSON
 *   error descriptions (which field was rejected, and why) -- without
 *   them, "Request failed with status 400" tells you nothing actionable.
 * - LockConflictError: reworded for this UI's audience. The CLI's own
 *   wording ("left behind by a crashed run — remove it manually") is
 *   right for a solo terminal user, but here it fires just as often
 *   because a second person legitimately clicked Run while the first
 *   is still going -- telling them to go delete a lock file is actively
 *   wrong advice in that case.
 */
export function formatMigrationError(err: unknown): MigrationErrorPayload {
  if (err instanceof LockConflictError) {
    return {
      kind: "lock_conflict",
      message:
        "Another migration for this environment pair is already running (or crashed without " +
        "cleaning up after itself). If you're sure nothing is actually running, ask whoever " +
        "manages this deployment to remove the lock file.",
    };
  }
  if (err instanceof PrismicApiError) {
    return {
      message: err.message,
      status: err.status,
      body: err.body,
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}
