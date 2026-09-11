import type { Config } from "../config.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { mappingFilePath } from "../lib/mapping-paths.js";
import { getDocumentById, getMasterRef } from "../lib/prismic-http.js";
import type { DocumentMapping } from "../types.js";

export type ConfirmOptions = {
  config: Config;
  pair: ResolvedPair;
  fetchImpl?: typeof fetch;
};

/**
 * Closes the loop the plan otherwise leaves open: how does the pipeline
 * learn that a human published the Migration Release? This has no
 * dedicated Release-status API to poll, so it asks the question the
 * pipeline actually cares about directly — "is this upper-environment
 * document now live at the upper environment's master ref?" — for every
 * mapping entry still `status: "pending"`. A document that answers yes
 * has definitely been published (Migration Release or otherwise); one
 * that answers no might just not have been reviewed yet, so it's left
 * `pending` rather than flagged as a problem.
 *
 * Run this after a human publishes the Migration Release in the upper
 * environment's dashboard — as its own CI step or a scheduled re-check,
 * not as part of Phase 2 itself, since Phase 2 has no way to know when
 * that will happen.
 */
export async function runConfirm({
  config,
  pair,
  fetchImpl = fetch,
}: ConfirmOptions): Promise<void> {
  log("info", "confirm.start", { from: pair.lowerName, to: pair.upperName });

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  let confirmed = 0;
  let stillPending = 0;

  await mappingStore.mutate(async (mapping) => {
    for (const [lowerId, entry] of Object.entries(mapping)) {
      if (entry.status !== "pending") continue;

      const live = await getDocumentById(pair.upper, upperRef, entry.upper_id, fetchImpl);
      if (live) {
        mapping[lowerId] = {
          ...entry,
          status: "synced",
          last_synced_at: new Date().toISOString(),
          last_synced_direction: "forward",
        };
        confirmed += 1;
        log("info", "confirm.published", { lowerId, upperId: entry.upper_id });
      } else {
        stillPending += 1;
      }
    }
    return mapping;
  });

  log("info", "confirm.done", { confirmed, stillPending });
}
