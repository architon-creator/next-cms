import { registerOTel } from "@vercel/otel";
import { initializeLoggerProvider } from "./logger";

export { getLogger } from "./logger";
export { createLogger, getTraceContext } from "./log-helper";
export type { Logger, LogLevel, LogAttributes } from "./log-helper";
// journey_id support (journey.ts: runWithJourneyId/getJourneyId/tagJourneyStep/
// tagJourneyStatus) is deferred — see backup/otel-logger-with-journey tag on
// this branch for the version with it wired in, to restore later.

// NOTE: generateTraceparent (trace-context.ts) is intentionally NOT
// re-exported here. This file's top-level import of @vercel/otel is
// Next.js-specific; anything imported from this main entry point is unsafe
// in a browser or Edge-runtime file. Import the browser-safe generator via
// its direct subpath instead: `otel/trace-context`.

export function register() {
  initializeLoggerProvider();

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "unknown-service",
    traceExporter: "auto",
  });
}
