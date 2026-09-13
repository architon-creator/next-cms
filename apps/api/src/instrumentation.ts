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
// directly here.
//
// getNodeAutoInstrumentations() includes HTTP instrumentation, which is
// what makes this half of the trace-context story work automatically: it
// extracts the `traceparent` header from every incoming request and
// continues that trace, joining whatever span the frontend's outbound
// fetch call already started — no custom extraction code needed.
//
// This builds the tracer provider directly with @opentelemetry/sdk-trace
// rather than going through NodeSDK: NodeSDK doesn't expose the provider it
// constructs, so there's no way to force a flush on demand. That matters
// specifically on Vercel — see flushOtel() below.
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// OTel swallows export failures (auth errors, network errors, wrong
// endpoint) silently unless diagnostics are turned on — this surfaces them
// in stderr/Vercel logs instead of a mysterious "no traces arrived".
if (process.env.OTEL_DEBUG === "true") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// HTTP, not gRPC — matches the frontend's @vercel/otel exporter (which only
// speaks OTLP/HTTP) and, more importantly, matches any public managed OTLP
// endpoint (e.g. Grafana Cloud's gateway), which only accepts HTTP.
// Defaults to http://localhost:4318 (the otel-collector's HTTP receiver)
// via OTEL_EXPORTER_OTLP_ENDPOINT if unset; this exporter appends the
// standard /v1/traces suffix itself, and reads OTEL_EXPORTER_OTLP_HEADERS
// automatically for auth (e.g. Grafana Cloud's Basic auth token).
const exporter = new OTLPTraceExporter();

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "next-cms-api",
  }),
  spanProcessors: [new BatchSpanProcessor(exporter)],
});

provider.register();

registerInstrumentations({
  instrumentations: [getNodeAutoInstrumentations()],
});

// Vercel's serverless runtime freezes the execution environment right after
// a request's response is sent — background work that hasn't completed by
// then (like the batch span processor's periodic/async export call) gets
// cut off mid-flight and never reaches the OTLP endpoint, even though the
// span itself was created successfully. api/index.ts calls this after every
// response finishes, and awaits it before letting the function return, so
// each invocation's spans are actually exported before the environment is
// allowed to suspend. Long-running processes (local dev, a real server)
// don't need this — the batch processor's own timer handles it — but
// calling it there too is harmless.
export async function flushOtel(): Promise<void> {
  await provider.forceFlush();
}

// Traces/spans should still flush on a graceful shutdown rather than being
// dropped mid-batch.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    provider
      .shutdown()
      .catch((err) => console.error("Error shutting down OTel SDK", err))
      .finally(() => process.exit(0));
  });
}
