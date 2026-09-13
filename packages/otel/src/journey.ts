import { AsyncLocalStorage } from "node:async_hooks";
import { trace } from "@opentelemetry/api";

// journey_id identifies one multi-page user flow (e.g. this app's
// personal-details -> contact-info -> documents -> preferences ->
// review-submit stepper — several separate page loads / separate OTEL
// traces). Unlike external_correlation_id (regenerated per request, ties
// one outbound call to one response), journey_id is generated ONCE at the
// start of the flow and persists — typically via a cookie set in
// middleware/proxy, since Server Components cannot set cookies themselves —
// across every subsequent page load until the flow ends.
//
// A trace is bounded to a single request; forcing a multi-page, multi-
// minute flow into one OTEL trace would produce an unusable waterfall.
// journey_id is instead set as a SPAN ATTRIBUTE (not just a log field) on
// every page/route's root span, so trace search (`journey_id=<id>`)
// returns every trace across all pages that share it — a business-level
// correlation layered on top of normal per-request tracing, not a
// replacement for it.
const journeyIdStorage = new AsyncLocalStorage<string>();

export function runWithJourneyId<T>(id: string, fn: () => T): T {
  return journeyIdStorage.run(id, fn);
}

export function getJourneyId(): string | undefined {
  return journeyIdStorage.getStore();
}

// Tags the active span with journey_id + the current step name. Call this
// once per page/route, right after entering runWithJourneyId. This — not
// the log line — is what makes the journey queryable across traces: trace
// search looks at span tags, not nested log-event fields.
export function tagJourneyStep(journeyId: string, step: string) {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute("journey_id", journeyId);
  span.setAttribute("journey_step", step);
  span.addEvent("journey.step", { journey_id: journeyId, step });
}

// Call on the terminal page of the flow to mark it finished (or explicitly
// abandoned, if you have a signal for that) — this is what turns "the last
// step seen" into an actual queryable completion rate later.
export function tagJourneyStatus(journeyId: string, status: "completed" | "abandoned") {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute("journey_id", journeyId);
  span.setAttribute("journey_status", status);
  span.addEvent("journey.status", { journey_id: journeyId, status });
}
