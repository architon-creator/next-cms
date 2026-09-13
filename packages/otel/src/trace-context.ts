// Deliberately dependency-free — no @opentelemetry/api, no async_hooks.
// This file must be safely importable from the BROWSER (client services)
// and the Edge runtime (middleware/proxy), neither of which can load the
// rest of this package (log-helper.ts, external-correlation.ts etc. depend
// on Node's async_hooks). Import this file directly via its subpath
// ("otel/src/trace-context"), never through the package's main index —
// that index eagerly imports @vercel/otel, which is Node-only.
//
// Generates a W3C Trace Context header (https://www.w3.org/TR/trace-context/):
//   traceparent: 00-<32 hex trace-id>-<16 hex parent-id>-<2 hex flags>
//
// A hand-crafted traceparent sent from the browser (no real OTEL SDK behind
// it) is extracted by @vercel/otel's auto-instrumentation and becomes the
// ACTUAL trace_id recorded for that request — W3C context extraction
// doesn't require the sender to be a "real" participating tracer, only
// that the header is formatted correctly. This is what lets the browser
// hand off a trace_id to the server without a full browser tracer SDK.
function randomHex(length: number): string {
  let hex = "";
  while (hex.length < length) {
    hex += crypto.randomUUID().replace(/-/g, "");
  }
  return hex.slice(0, length);
}

export function generateTraceparent(): string {
  const traceId = randomHex(32);
  const parentId = randomHex(16);
  const sampledFlag = "01"; // request that downstream systems record/export this trace
  return `00-${traceId}-${parentId}-${sampledFlag}`;
}
