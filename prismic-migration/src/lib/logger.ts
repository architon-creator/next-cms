type LogLevel = "info" | "warn" | "error";

/**
 * One JSON object per line to stdout — feeds directly into whatever log
 * aggregation the target CI already has (Phase 5: "structured logs for
 * every create/update").
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
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields }));
}
