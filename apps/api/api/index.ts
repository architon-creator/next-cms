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
import { waitUntil } from "@vercel/functions";
import { createApp } from "../src/app.js";
import { flushOtel } from "../src/instrumentation.js";

const app = createApp();

// Wrapping the Express app (rather than exporting it directly) is what
// lets us hook the OTel flush in. Awaiting our own promise here would NOT
// be enough on its own — Vercel finalizes an invocation's logs and freezes
// the execution environment based on when the HTTP response itself
// finishes, not on when the exported handler's returned promise resolves,
// so any work started after `res.finish` was silently getting cut off
// mid-export even inside an awaited async handler (confirmed via
// OTEL_DEBUG diagnostics: spans were queued but the export's success/
// failure was never logged). `waitUntil` is Vercel's supported mechanism
// for exactly this: it tells the runtime to keep the invocation alive
// until the given promise settles, even after the response has been sent.
export default function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
): void {
  const flushed = new Promise<void>((resolve) => {
    res.once("finish", resolve);
    res.once("close", resolve);
    app(req, res);
  }).then(() => flushOtel());

  waitUntil(
    flushed.then(() => {
      console.log("[otel-debug] flushOtel() resolved via waitUntil");
    }),
  );
}
