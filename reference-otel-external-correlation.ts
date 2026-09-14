import { AsyncLocalStorage } from "node:async_hooks";

// external_correlation_id identifies one outbound call to a system WE DO
// NOT CONTROL — a third-party vendor or integration. This is deliberately
// NOT the same mechanism as trace_id/traceparent (see trace-context.ts):
//
// For boundaries we control (browser -> our Next.js server -> our own
// backend), traceparent is strictly better — both ends run real OTEL, both
// extract/propagate it automatically, giving one true distributed trace
// with zero custom code.
//
// For an external vendor system, we CANNOT assume that. It almost
// certainly doesn't run OTEL and won't extract or forward a traceparent
// header the way our own services would. Sending it a "correlation id"
// buys nothing from THEM automatically continuing anything — the value is
// entirely on OUR side: our own request/response logs record "we sent this
// vendor this exact ID, on this exact request," which is durable and
// searchable on our end regardless of what the external system does with it.
const externalCorrelationIdStorage = new AsyncLocalStorage<string>();

export function runWithExternalCorrelationId<T>(id: string, fn: () => T): T {
  return externalCorrelationIdStorage.run(id, fn);
}

export function getExternalCorrelationId(): string | undefined {
  return externalCorrelationIdStorage.getStore();
}
