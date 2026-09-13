// Framework-agnostic entry point — everything here is safe to import from a
// plain Node process (e.g. apps/api's Express server), unlike the package's
// main index, whose top-level `import "@vercel/otel"` is Next.js-specific
// and breaks when loaded through a generic Node OTel SDK setup (its bundled
// output isn't designed to survive being re-required through
// require-in-the-middle's CJS interception the way a Node SDK's auto-
// instrumentation does — it throws "Cannot access 'require' before
// initialization"). Import from here instead: `otel/logging`.
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
