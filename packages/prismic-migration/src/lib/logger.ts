import { AsyncLocalStorage } from "node:async_hooks";

type LogLevel = "info" | "warn" | "error";

/** One already-serialized `{ ts, level, event, ...fields }` line. */
export type LogSink = (line: string) => void;

// Lets a caller (e.g. a web request handler running a migration on
// someone's behalf) capture one invocation's log lines in isolation,
// without threading a logger through every phase function's call sites —
// every phase file already imports `log` directly from this module and
// calls it as a bare function. AsyncLocalStorage scopes the sink to
// whatever's running inside runWithLogSink, so concurrent requests each
// see only their own lines, and the CLI (which never calls
// runWithLogSink) is unaffected — its store is always empty, so `log`
// falls through to the original console.log behavior below unchanged.
const sinkStorage = new AsyncLocalStorage<LogSink>();

/**
 * One JSON object per line to stdout — feeds directly into whatever log
 * aggregation the target CI already has (Phase 5: "structured logs for
 * every create/update"). Routed to the active runWithLogSink's sink
 * instead, if one is active for the current async context.
 *
 * This does NOT redact anything itself — never pass a token, header, or
 * full HTTP request into `fields`. Callers are the ones who know which
 * values are secrets; keep them out before they get here.
 */
export function log(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  const sink = sinkStorage.getStore();
  if (sink) {
    sink(line);
  } else {
    console.log(line);
  }
}

/**
 * Runs `fn`, routing every `log(...)` call anywhere inside it (including
 * deep inside phase0-4, however many functions down) to `sink` instead of
 * stdout. Intended for a non-CLI caller — e.g. an admin UI's API route —
 * that wants one migration run's log stream on its own, to forward over
 * SSE/WebSocket rather than leaving it on the server process's stdout.
 */
export function runWithLogSink<T>(sink: LogSink, fn: () => Promise<T>): Promise<T> {
  return sinkStorage.run(sink, fn);
}
