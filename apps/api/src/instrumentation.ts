// Must be the FIRST import in server.ts, before ./app.js (and therefore
// before express, http, etc. are ever loaded) — OTel's Node auto-
// instrumentation patches those modules at require/import time, so the SDK
// has to start before anything else pulls them in. ES module top-level
// imports are evaluated in the order they're written, so this ordering
// guarantee holds as long as this stays the first line of server.ts.
//
// Unlike apps/frontend (a Next.js app using @vercel/otel, wired through
// instrumentation.ts's Next-specific register() hook), this is a plain
// Express app — there's no framework hook to lean on, so the SDK is started
// directly here with @opentelemetry/sdk-node.
//
// getNodeAutoInstrumentations() includes HTTP instrumentation, which is
// what makes this half of the trace-context story work automatically: it
// extracts the `traceparent` header from every incoming request and
// continues that trace, joining whatever span the frontend's outbound
// fetch call already started — no custom extraction code needed.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "next-cms-api",
  }),
  // Defaults to http://localhost:4317 (the otel-collector's gRPC receiver —
  // see docker-compose.yml at the repo root) via OTEL_EXPORTER_OTLP_ENDPOINT
  // if unset, same as the frontend's OTLPTraceExporter default.
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Traces/spans should still flush on a graceful shutdown rather than being
// dropped mid-batch.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    sdk
      .shutdown()
      .catch((err) => console.error("Error shutting down OTel SDK", err))
      .finally(() => process.exit(0));
  });
}
