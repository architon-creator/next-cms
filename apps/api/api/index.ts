// Vercel's Node.js runtime treats a default-exported handler as the request
// entry point — no app.listen() needed (or wanted; Vercel invokes the
// export per-request in its own serverless runtime). Every path is routed
// here via vercel.json's catch-all rewrite; Express's own routers then
// dispatch based on the real incoming req.url exactly as they would under a
// normal long-running server.
//
// Same import-order requirement as src/server.ts: dotenv before
// instrumentation (which reads OTEL_* env vars at import time), and
// instrumentation before ./app.js (so its auto-instrumentation patches
// http/express before either is ever required).
import "dotenv/config";
import "../src/instrumentation.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";
import { flushOtel } from "../src/instrumentation.js";

const app = createApp();

// A plain `export default createApp()` (an Express app is just a request
// handler function) would let Vercel return the response and freeze the
// execution environment immediately after — before the OTel batch exporter's
// async HTTP call to the OTLP endpoint has actually completed. Wrapping it
// so this async function itself is the handler means Vercel awaits us, and
// we don't resolve until the response has finished AND the resulting spans
// have been flushed out.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await new Promise<void>((resolve) => {
    res.once("finish", resolve);
    res.once("close", resolve);
    app(req, res);
  });

  await flushOtel();
}
