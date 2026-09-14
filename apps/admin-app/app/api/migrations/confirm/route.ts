// Same streaming shape as ../promote/route.ts (see that file's header
// for why GET+SSE). Kept as a separate route rather than a `type` query
// param on one handler: `confirm` and `promote` have different
// preconditions — confirm assumes a human already published the
// Migration Release in Prismic's own dashboard; nothing here can do that
// publish step for them, Prismic requires a human there by design.
//
// Same TODO as promote/route.ts: no auth check here yet.
import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runConfirmAction } from "prismic-migration/actions";
import { runWithLogSink } from "prismic-migration/logger";
import { createRunLog } from "@/lib/run-log-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return new Response("from and to query params are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const runLog = await createRunLog("confirm", from, to);
      send("meta", { runLogFilename: runLog.filename });

      const sink = (line: string) => {
        send("log", JSON.parse(line));
        void runLog.appendLine(line);
      };

      try {
        const config = loadConfig();
        const result = await runWithLogSink(sink, () => runConfirmAction(config, from, to));
        send("done", result);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
