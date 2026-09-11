import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { assetMappingFilePath, mappingFilePath } from "../lib/mapping-paths.js";
import {
  getDocumentById,
  getMasterRef,
  updateMigrationDocument,
} from "../lib/prismic-http.js";
import { rewriteRefs } from "../lib/rewrite-refs.js";
import type { AssetMapping, DocumentMapping, MappingEntry } from "../types.js";

export type SyncVerdict =
  "noop" | "sync-upper-to-lower" | "pending-lower-to-upper" | "conflict";

/**
 * The full 2x2 case analysis for back-sync, made explicit (the original
 * plan's own text only named two of these four rows):
 *
 *                upper unchanged     upper changed
 * lower unchanged   noop              sync-upper-to-lower (fast-forward)
 * lower changed     pending-lower-to-upper  conflict
 *
 * "lower changed, upper unchanged" is NOT a conflict — the lower
 * environment has an edit the upper one doesn't know about yet, but
 * nothing on the upper side would be lost by catching it up. It becomes
 * a normal Phase 2 forward-sync candidate: `status: "pending"` here
 * means "run Phase 2 (migrate) again", not "needs a human". Only "both
 * sides changed independently" is a genuine conflict.
 *
 * Pure and network-free by design, so this is the one piece of the whole
 * toolkit that's fully unit-tested without mocking any HTTP calls.
 */
export function classifySync(
  entry: MappingEntry,
  currentLowerHash: string,
  currentUpperHash: string,
): SyncVerdict {
  const lowerUnchanged = currentLowerHash === entry.lower_hash;
  const upperUnchanged = currentUpperHash === entry.upper_hash;

  if (lowerUnchanged && upperUnchanged) return "noop";
  if (lowerUnchanged && !upperUnchanged) return "sync-upper-to-lower";
  if (!lowerUnchanged && upperUnchanged) return "pending-lower-to-upper";
  return "conflict";
}

export type Phase4Options = {
  config: Config;
  pair: ResolvedPair;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type Phase4Result = {
  synced: number;
  pending: number;
  conflicts: {
    lowerId: string;
    upperId: string;
    docType: string;
    lastSyncedAt: string;
  }[];
};

/**
 * Ongoing back-sync, upper -> lower (the caller enforces this direction
 * via requireDirection before calling in — see cli.ts), gated by
 * classifySync above. Only `status: "synced"` entries are candidates — a
 * `pending` or `conflict` entry is left for a human (or the next
 * Phase 2/migrate run) to resolve, never silently reprocessed here.
 *
 * Note: this back-syncs document content, not assets. Phase 1's asset
 * pipeline is lower -> upper only; an asset uploaded fresh in the upper
 * environment during back-sync would need its own lower-ward asset
 * mapping, which this toolkit does not implement.
 */
export async function runPhase4({
  config,
  pair,
  dryRun,
  fetchImpl = fetch,
}: Phase4Options): Promise<Phase4Result> {
  log("info", "phase4.start", { dryRun, from: pair.upperName, to: pair.lowerName });

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMapping = await assetMappingStore.load();
  // Reverse direction for upper -> lower asset ids (see the caveat above —
  // this will be empty for anything only ever migrated lower -> upper).
  // No `url` here — there's no recorded "lower CDN url" to restore to,
  // unlike the forward direction's upper_asset_url; only `id` gets
  // rewritten going backward.
  const reverseAssetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([lowerId, e]) => [
      e.upper_asset_id,
      { id: lowerId },
    ]),
  );

  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  const result: Phase4Result = { synced: 0, pending: 0, conflicts: [] };

  await mappingStore.mutate(async (mapping) => {
    const reverseDocumentIds = Object.fromEntries(
      Object.entries(mapping).map(([lowerId, e]) => [e.upper_id, lowerId]),
    );

    for (const [lowerId, entry] of Object.entries(mapping)) {
      if (entry.status !== "synced") continue;

      const [lowerDoc, upperDoc] = await Promise.all([
        getDocumentById(pair.lower, lowerRef, lowerId, fetchImpl),
        getDocumentById(pair.upper, upperRef, entry.upper_id, fetchImpl),
      ]);
      if (!lowerDoc || !upperDoc) continue; // deleted on one side — out of scope for this toolkit's conflict model

      const currentLowerHash = canonicalHash(lowerDoc.data);
      const currentUpperHash = canonicalHash(upperDoc.data);
      const verdict = classifySync(entry, currentLowerHash, currentUpperHash);

      switch (verdict) {
        case "noop":
          continue;

        case "pending-lower-to-upper":
          mapping[lowerId] = { ...entry, status: "pending" };
          result.pending += 1;
          log("info", "phase4.pending_forward_sync", {
            lowerId,
            upperId: entry.upper_id,
          });
          continue;

        case "conflict":
          mapping[lowerId] = { ...entry, status: "conflict" };
          result.conflicts.push({
            lowerId,
            upperId: entry.upper_id,
            docType: entry.doc_type,
            lastSyncedAt: entry.last_synced_at,
          });
          log("warn", "phase4.conflict", { lowerId, upperId: entry.upper_id });
          continue;

        case "sync-upper-to-lower": {
          const rewritten = rewriteRefs(upperDoc.data, {
            assetIds: reverseAssetIds,
            documentIds: reverseDocumentIds,
          });

          if (dryRun) {
            log("info", "phase4.would_sync_upper_to_lower", {
              lowerId,
              upperId: entry.upper_id,
            });
            continue;
          }

          // Lands as a draft in the lower environment's own Migration
          // Release, same as any other write this toolkit makes — rule #3
          // ("nothing auto-publishes in the target repo") applies to the
          // lower environment here too, since it's the write target for
          // this direction.
          await updateMigrationDocument(
            pair.lower,
            lowerId,
            { data: rewritten },
            fetchImpl,
          );
          mapping[lowerId] = {
            ...entry,
            lower_hash: canonicalHash(rewritten),
            upper_hash: currentUpperHash,
            last_synced_at: new Date().toISOString(),
            last_synced_direction: "backward",
          };
          result.synced += 1;
          log("info", "phase4.synced_upper_to_lower", {
            lowerId,
            upperId: entry.upper_id,
          });
        }
      }
    }
    return mapping;
  });

  if (result.conflicts.length > 0) {
    await mkdir(config.reportDir, { recursive: true });
    const reportPath = join(
      config.reportDir,
      `conflicts-${pair.lowerName}-${pair.upperName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
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
