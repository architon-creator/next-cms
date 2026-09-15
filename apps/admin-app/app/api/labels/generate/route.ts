import type { NextRequest } from "next/server";
import path from "node:path";
import { spawnAndStream } from "@/lib/spawn-log";

// Runs `pnpm run prismic-model-generate` (packages/cms/scripts/
// generate-prismic-models-demo.ts) as a child process and streams its
// output, rather than importing that script's logic in-process — it
// resolves its own env files relative to process.cwd() (see
// packages/cms/src/prismic/config.ts), which is only correct when cwd is
// packages/cms itself; spawning with cwd set there preserves that
// behavior exactly instead of risking it silently reading the wrong env
// files under admin-app's own process.
//
// Only ever writes local files under packages/cms/customtypes/ — nothing
// here touches a real Prismic environment, so (unlike generate/seed's
// sibling routes) there's no dry-run concept and nothing to confirm.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cmsDir = path.resolve(process.cwd(), "../../packages/cms");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const namespaces = searchParams.get("namespaces"); // comma-separated; omitted/empty = all

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const args = namespaces
        ? ["run", "prismic-model-generate", "--", `--namespaces=${namespaces}`]
        : ["run", "prismic-model-generate"];

      try {
        const { exitCode } = await spawnAndStream(
          "pnpm",
          args,
          cmsDir,
          (line) => send("log", { line }),
        );
        if (exitCode === 0) {
          send("done", { ok: true });
        } else {
          send("error", { message: `generate script exited with code ${exitCode}` });
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // The script itself only ever writes local files and finishes on
      // its own in a few seconds — nothing dangerous about letting it run
      // to completion server-side even if the browser navigates away.
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
