// Vercel's Node.js runtime treats a default-exported Express app as a
// request handler directly — no app.listen() needed (or wanted; Vercel
// invokes the export per-request in its own serverless runtime). Every
// path is routed here via vercel.json's catch-all rewrite; Express's own
// routers then dispatch based on the real incoming req.url exactly as
// they would under a normal long-running server.
//
// Same import-order requirement as src/server.ts: dotenv before
// instrumentation (which reads OTEL_* env vars at import time), and
// instrumentation before ./app.js (so its auto-instrumentation patches
// http/express before either is ever required).
import "dotenv/config";
import "../src/instrumentation.js";
import { createApp } from "../src/app.js";

export default createApp();
