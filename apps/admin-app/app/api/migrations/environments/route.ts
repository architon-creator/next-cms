import { loadConfig } from "prismic-migration/config";
import { listPairStatuses } from "prismic-migration/actions";

// Lets the UI populate its from/to dropdowns from the actual configured
// ENVIRONMENT_CHAIN (see packages/prismic-migration/src/config.ts) instead
// of a hardcoded guess that could silently drift from real config.
export async function GET() {
  const config = loadConfig();
  const pairStatuses = await listPairStatuses(config);
  return Response.json({
    chain: config.environmentChain,
    // Only environments with a `<NAME>_REPOSITORY` env var actually set —
    // lets the UI grey out an environment nobody's configured yet (e.g.
    // PROD, before it exists) instead of letting you pick it and fail.
    configured: Object.keys(config.environments),
    // Per-adjacent-hop sync counts (same data the dashboard shows) — lets
    // the migrations page's own chain strip surface hop health without a
    // trip to "/" first.
    pairStatuses,
  });
}
