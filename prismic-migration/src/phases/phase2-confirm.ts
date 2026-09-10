import { join } from "node:path";
import type { Config } from "../config.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { getDocumentById, getMasterRef } from "../lib/prismic-http.js";
import type { DocumentMapping } from "../types.js";

export type ConfirmOptions = {
  config: Config;
  fetchImpl?: typeof fetch;
};

/**
 * Closes the loop the plan otherwise leaves open: how does the pipeline
 * learn that a human published the Migration Release? This has no
 * dedicated Release-status API to poll, so it asks the question the
 * pipeline actually cares about directly — "is this sit document now live
 * at sit's master ref?" — for every mapping entry still `status: "pending"`.
 * A document that answers yes has definitely been published (Migration
 * Release or otherwise); one that answers no might just not have been
 * reviewed yet, so it's left `pending` rather than flagged as a problem.
 *
 * Run this after a human publishes the Migration Release in the sit
 * dashboard — as its own CI step or a scheduled re-check, not as part of
 * Phase 2 itself, since Phase 2 has no way to know when that will happen.
 */
export async function runConfirm({
  config,
  fetchImpl = fetch,
}: ConfirmOptions): Promise<void> {
  log("info", "confirm.start");

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const sitRef = await getMasterRef(config.sit, fetchImpl);

  let confirmed = 0;
  let stillPending = 0;

  await mappingStore.mutate(async (mapping) => {
    for (const [devId, entry] of Object.entries(mapping)) {
      if (entry.status !== "pending") continue;

      const live = await getDocumentById(config.sit, sitRef, entry.sit_id, fetchImpl);
      if (live) {
        mapping[devId] = {
          ...entry,
          status: "synced",
          last_synced_at: new Date().toISOString(),
          last_synced_direction: "dev->sit",
        };
        confirmed += 1;
        log("info", "confirm.published", { devId, sitId: entry.sit_id });
      } else {
        stillPending += 1;
      }
    }
    return mapping;
  });

  log("info", "confirm.done", { confirmed, stillPending });
}
