import type { NextRequest } from "next/server";
import path from "node:path";
import { isLabelsToolEnabled } from "@/lib/labels-guard";
import { parseNamespaceListParam, spawnAndStream } from "@/lib/spawn-log";

// Same child-process approach as ../generate/route.ts, and same reasoning
// for why (packages/cms/src/prismic/config.ts's cwd-relative env loading).
//
// UNLIKE generate, this one writes real documents to the real "next-js-ssr"
// repository (creates/updates one singleton per namespace, then the
// app_labels hub) once --write is passed — seed-prismic-content-demo.ts
// already defaults to a dry run and only writes with --write, so that
// safety behavior is preserved untouched here, just forwarded through.
//
// No auth on this route — same known, already-flagged gap as every other
// write-capable admin-app route (see /api/migrations/promote and
// friends); not introducing a new inconsistency by guarding only this one.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cmsDir = path.resolve(process.cwd(), "../../packages/cms");

export async function GET(req: NextRequest) {
  if (!isLabelsToolEnabled()) {
    return new Response("The labels tool is disabled in this environment.", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const write = searchParams.get("write") === "true";

  let namespaces: string[] | null;
  try {
    namespaces = parseNamespaceListParam(searchParams.get("namespaces"));
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const scriptArgs = [
        ...(write ? ["--write"] : []),
        ...(namespaces ? [`--namespaces=${namespaces.join(",")}`] : []),
      ];
      const args =
        scriptArgs.length > 0
          ? ["run", "prismic-seed-content", "--", ...scriptArgs]
          : ["run", "prismic-seed-content"];

      // Set when seed-prismic-content-demo.ts logs its "every requested
      // namespace was skipped" line (see that script) — lets the UI show
      // an honest "nothing happened" result instead of "Content seeded."
      // for a run that skipped every namespace it was asked to seed.
      let nothingToSeed = false;

      try {
        const { exitCode } = await spawnAndStream("pnpm", args, cmsDir, (line) => {
          if (line.includes("Nothing to seed —")) nothingToSeed = true;
          send("log", { line });
        });
        if (exitCode === 0) {
          send("done", { ok: true, write, nothingToSeed });
        } else {
          send("error", { message: `seed script exited with code ${exitCode}` });
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // Unlike generate, a --write run does touch the real repository —
      // but it's already in flight against Prismic's API by the time the
      // browser could cancel, and half-applying that write is worse than
      // letting it finish unobserved. Same call the migration toolkit's
      // own promote/rollback routes make.
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
