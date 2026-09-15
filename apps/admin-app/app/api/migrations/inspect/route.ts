import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runInspectAction } from "prismic-migration/actions";

// Backs the "Inspect" action on a verify mismatch — fetches both sides of
// one mapped document live so a person can see exactly what differs,
// instead of having to run `pnpm cli inspect` from a terminal.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const lowerId = searchParams.get("lowerId");

  if (!from || !to || !lowerId) {
    return new Response("from, to, and lowerId query params are required", { status: 400 });
  }

  try {
    const config = loadConfig();
    const result = await runInspectAction(config, from, to, lowerId);
    return Response.json(result);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
