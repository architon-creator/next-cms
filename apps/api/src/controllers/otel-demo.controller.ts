import type { Request, Response } from "express";
import { createLogger, getTraceContext } from "otel/logging";

const logger = createLogger("backend/otel-demo");

export interface DemoItem {
  id: number;
  label: string;
}

const demoItems: DemoItem[] = [
  { id: 1, label: "First demo item" },
  { id: 2, label: "Second demo item" },
  { id: 3, label: "Third demo item" },
];

// Exists purely to make the SSR/CSR tracing example real rather than
// hand-waved: any caller — the frontend's SSR page render or a browser
// button click — hits this same endpoint, and getTraceContext() below
// shows the SAME trace_id the caller sent, because @opentelemetry/auto-
// instrumentations-node extracted it from the incoming request's
// `traceparent` header before this handler even runs (see
// instrumentation.ts). Nothing in this file does that extraction manually.
export async function getDemoItems(_req: Request, res: Response) {
  const traceId = getTraceContext()?.traceId;

  logger.info("Fetching demo items", { count: demoItems.length });

  // Small artificial delay so the SSR/CSR spans have a visible, non-zero
  // duration in Jaeger instead of collapsing to ~0ms.
  await new Promise((resolve) => setTimeout(resolve, 150));

  res.json({ success: true, items: demoItems, traceId });
}
