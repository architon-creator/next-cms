import { registerOTel } from "@vercel/otel";
import { initializeLoggerProvider } from "./logger.js";

export { getLogger } from "./logger.js";
export { createLogger, getTraceContext } from "./log-helper.js";
export type { Logger, LogLevel, LogAttributes } from "./log-helper.js";
export {
  runWithExternalCorrelationId,
  getExternalCorrelationId,
} from "./external-correlation.js";
export {
  runWithJourneyId,
  getJourneyId,
  tagJourneyStep,
  tagJourneyStatus,
} from "./journey.js";

// NOTE: generateTraceparent (trace-context.ts) is intentionally NOT
// re-exported here. This file's top-level import of @vercel/otel is
// Next.js-specific; anything imported from this main entry point is unsafe
// in a browser, Edge-runtime, or plain Node (e.g. apps/api) file. Import
// the browser-safe generator via its direct subpath instead:
// `otel/trace-context`. For a plain Node consumer's logger/correlation
// needs, see `otel/logging`.

export function register() {
  initializeLoggerProvider();

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "unknown-service",
    traceExporter: "auto",
  });
}
