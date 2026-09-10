import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import {
  getDocumentById,
  getMasterRef,
  updateMigrationDocument,
} from "../lib/prismic-http.js";
import { rewriteRefs } from "../lib/rewrite-refs.js";
import type { AssetMapping, DocumentMapping, MappingEntry } from "../types.js";

export type SyncVerdict = "noop" | "sync-sit-to-dev" | "pending-dev-to-sit" | "conflict";

/**
 * The full 2x2 case analysis for back-sync, made explicit (the plan's own
 * text only names two of these four rows):
 *
 *              sit unchanged        sit changed
 * dev unchanged   noop              sync-sit-to-dev (fast-forward)
 * dev changed     pending-dev-to-sit  conflict
 *
 * "dev changed, sit unchanged" is NOT a conflict — dev has an edit sit
 * doesn't know about yet, but nothing on sit's side would be lost by
 * catching sit up. It becomes a normal Phase 2 forward-sync candidate:
 * `status: "pending"` here means "run Phase 2 again", not "needs a human".
 * Only "both sides changed independently" is a genuine conflict.
 *
 * Pure and network-free by design, so this is the one piece of the whole
 * toolkit that's fully unit-tested without mocking any HTTP calls.
 */
export function classifySync(
  entry: MappingEntry,
  currentDevHash: string,
  currentSitHash: string,
): SyncVerdict {
  const devUnchanged = currentDevHash === entry.dev_hash;
  const sitUnchanged = currentSitHash === entry.sit_hash;

  if (devUnchanged && sitUnchanged) return "noop";
  if (devUnchanged && !sitUnchanged) return "sync-sit-to-dev";
  if (!devUnchanged && sitUnchanged) return "pending-dev-to-sit";
  return "conflict";
}

export type Phase4Options = {
  config: Config;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type Phase4Result = {
  synced: number;
  pending: number;
  conflicts: { devId: string; sitId: string; docType: string; lastSyncedAt: string }[];
};

/**
 * Ongoing back-sync, sit -> dev, gated by classifySync above. Only
 * `status: "synced"` entries are candidates — a `pending` or `conflict`
 * entry is left for a human (or the next Phase 2 run) to resolve, never
 * silently reprocessed here.
 *
 * Note: this back-syncs document content, not assets. The plan's asset
 * pipeline (Phase 1) is dev -> sit only; an asset uploaded fresh in sit
 * during back-sync would need its own dev-ward asset mapping, which this
 * POC does not implement.
 */
export async function runPhase4({
  config,
  dryRun,
  fetchImpl = fetch,
}: Phase4Options): Promise<Phase4Result> {
  log("info", "phase4.start", { dryRun });

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    join(config.mappingDir, "asset-mapping.json"),
  );
  const assetMapping = await assetMappingStore.load();
  // Reverse direction for sit -> dev asset ids (see the caveat above — this
  // will be empty for anything only ever migrated dev -> sit).
  const reverseAssetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([devId, e]) => [e.sit_asset_id, devId]),
  );

  const devRef = await getMasterRef(config.dev, fetchImpl);
  const sitRef = await getMasterRef(config.sit, fetchImpl);

  const result: Phase4Result = { synced: 0, pending: 0, conflicts: [] };

  await mappingStore.mutate(async (mapping) => {
    const reverseDocumentIds = Object.fromEntries(
      Object.entries(mapping).map(([devId, e]) => [e.sit_id, devId]),
    );

    for (const [devId, entry] of Object.entries(mapping)) {
      if (entry.status !== "synced") continue;

      const [devDoc, sitDoc] = await Promise.all([
        getDocumentById(config.dev, devRef, devId, fetchImpl),
        getDocumentById(config.sit, sitRef, entry.sit_id, fetchImpl),
      ]);
      if (!devDoc || !sitDoc) continue; // deleted on one side — out of scope for this POC's conflict model

      const currentDevHash = canonicalHash(devDoc.data);
      const currentSitHash = canonicalHash(sitDoc.data);
      const verdict = classifySync(entry, currentDevHash, currentSitHash);

      switch (verdict) {
        case "noop":
          continue;

        case "pending-dev-to-sit":
          mapping[devId] = { ...entry, status: "pending" };
          result.pending += 1;
          log("info", "phase4.pending_forward_sync", { devId, sitId: entry.sit_id });
          continue;

        case "conflict":
          mapping[devId] = { ...entry, status: "conflict" };
          result.conflicts.push({
            devId,
            sitId: entry.sit_id,
            docType: entry.doc_type,
            lastSyncedAt: entry.last_synced_at,
          });
          log("warn", "phase4.conflict", { devId, sitId: entry.sit_id });
          continue;

        case "sync-sit-to-dev": {
          const rewritten = rewriteRefs(sitDoc.data, {
            assetIds: reverseAssetIds,
            documentIds: reverseDocumentIds,
          });

          if (dryRun) {
            log("info", "phase4.would_sync_sit_to_dev", { devId, sitId: entry.sit_id });
            continue;
          }

          // Lands as a draft in dev's own Migration Release, same as any
          // other write this toolkit makes — rule #3 ("nothing
          // auto-publishes in the target repo") applies to dev here too,
          // since dev is the write target for this direction.
          await updateMigrationDocument(
            config.dev,
            devId,
            { data: rewritten },
            fetchImpl,
          );
          mapping[devId] = {
            ...entry,
            dev_hash: canonicalHash(rewritten),
            sit_hash: currentSitHash,
            last_synced_at: new Date().toISOString(),
            last_synced_direction: "sit->dev",
          };
          result.synced += 1;
          log("info", "phase4.synced_sit_to_dev", { devId, sitId: entry.sit_id });
        }
      }
    }
    return mapping;
  });

  if (result.conflicts.length > 0) {
    await mkdir(config.reportDir, { recursive: true });
    const reportPath = join(
      config.reportDir,
      `conflicts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(reportPath, JSON.stringify(result.conflicts, null, 2), "utf8");
    log("error", "phase4.conflicts_reported", {
      count: result.conflicts.length,
      reportPath,
    });
  }

  log("info", "phase4.done", { ...result, conflictCount: result.conflicts.length });
  return result;
}
