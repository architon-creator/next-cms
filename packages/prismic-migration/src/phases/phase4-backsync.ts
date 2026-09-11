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
  listAssets,
  updateMigrationDocument,
  uploadAsset,
} from "../lib/prismic-http.js";
import { assetContentHash } from "./phase1-assets.js";
import { rewriteRefs } from "../lib/rewrite-refs.js";
import type { AssetMapping, DocumentMapping, MappingEntry } from "../types.js";

export type AssetBacksyncResult = { migrated: number; skipped: number };

/**
 * The asset half of back-sync — mirrors phase1-assets.ts's forward
 * migration, but upper -> lower: enumerates the upper environment's asset
 * library and, for any asset not yet recorded (or whose content has
 * changed since it was), downloads it and uploads a copy into the lower
 * environment's library. Closes the gap phase4's own doc comment used to
 * name: "an asset uploaded fresh in the upper environment during
 * back-sync would need its own lower-ward asset mapping, which this
 * toolkit does not implement."
 *
 * Idempotency works the same way as phase1-assets.ts, just checked
 * against `upper_hash` instead of `lower_hash` — the two are only ever
 * set to different values once one side's asset changes independently of
 * the other (see the fields' doc comments in types.ts). Looked up via a
 * upper_asset_id -> entry index rather than a direct key lookup, since
 * this function iterates upper assets (whose id IS known up front) but
 * the mapping is keyed by the LOWER asset id (not known until a fresh
 * upload completes).
 *
 * On a changed upper asset, this uploads a fresh copy to the lower
 * environment and inserts a new mapping entry keyed by that new lower
 * asset id — it does not delete the old, now-stale entry, mirroring
 * phase1-assets.ts's own accepted trade-off on the forward side (an
 * orphaned previously-uploaded asset is left behind rather than cleaned
 * up automatically).
 *
 * Runs BEFORE `runPhase4`'s document sync builds its `reverseAssetIds`
 * map, so a document referencing a brand-new upper asset can be rewritten
 * correctly in the same run, without requiring two separate `backsync`
 * invocations.
 */
export async function runAssetBacksync(
  config: Config,
  pair: ResolvedPair,
  dryRun: boolean,
  fetchImpl: typeof fetch,
): Promise<AssetBacksyncResult> {
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const upperAssets = await listAssets(pair.upper, fetchImpl);
  log("info", "phase4.upper_assets_enumerated", { count: upperAssets.length });

  let migrated = 0;
  let skipped = 0;

  await assetMappingStore.mutate(async (mapping) => {
    const byUpperAssetId = new Map(
      Object.entries(mapping).map(([lowerId, entry]) => [entry.upper_asset_id, lowerId]),
    );

    for (const asset of upperAssets) {
      const contentHash = assetContentHash(asset.filename, asset.size);
      const existingLowerId = byUpperAssetId.get(asset.id);
      const existing = existingLowerId ? mapping[existingLowerId] : undefined;

      if (existing && existing.upper_hash === contentHash) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        log("info", "phase4.would_migrate_asset", {
          upperAssetId: asset.id,
          filename: asset.filename,
        });
        continue;
      }

      const downloaded = await fetchImpl(asset.url);
      if (!downloaded.ok) {
        log("error", "phase4.asset_download_failed", {
          upperAssetId: asset.id,
          status: downloaded.status,
        });
        continue;
      }
      const blob = await downloaded.blob();
      const uploaded = await uploadAsset(pair.lower, blob, asset.filename, fetchImpl);

      mapping[uploaded.id] = {
        upper_asset_id: asset.id,
        upper_asset_url: asset.url,
        lower_asset_url: uploaded.url,
        lower_hash: contentHash,
        upper_hash: contentHash,
        migrated_at: new Date().toISOString(),
      };
      migrated += 1;
      log("info", "phase4.asset_migrated", {
        upperAssetId: asset.id,
        lowerAssetId: uploaded.id,
        filename: asset.filename,
      });
    }
    return mapping;
  });

  log("info", "phase4.assets_done", { dryRun, migrated, skipped });
  return { migrated, skipped };
}

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
  /**
   * A "synced" mapping entry whose lower or upper document no longer
   * exists — deleted directly in one environment's dashboard, outside
   * this toolkit. Previously a silent `continue`; now logged and
   * returned so a run doesn't quietly do nothing about it. Still out of
   * scope to actually resolve (unlike `conflict`, this doesn't set
   * `status`, since there's no well-defined action to take automatically —
   * a human needs to decide whether to `unlink` the entry, or recreate
   * the deleted document via `migrate`/`backsync`).
   */
  deletedOnOneSide: {
    lowerId: string;
    upperId: string;
    docType: string;
    deletedSide: "lower" | "upper";
  }[];
  assetsMigrated: number;
  assetsSkipped: number;
};

/**
 * Ongoing back-sync, upper -> lower (the caller enforces this direction
 * via requireDirection before calling in — see cli.ts), gated by
 * classifySync above. Only `status: "synced"` entries are candidates — a
 * `pending` or `conflict` entry is left for a human (or the next
 * Phase 2/migrate run) to resolve, never silently reprocessed here.
 *
 * Runs the asset half of back-sync first (see runAssetBacksync above),
 * so a document containing a reference to a brand-new upper asset is
 * rewritten correctly in the same invocation, not left broken until a
 * second run.
 */
export async function runPhase4({
  config,
  pair,
  dryRun,
  fetchImpl = fetch,
}: Phase4Options): Promise<Phase4Result> {
  log("info", "phase4.start", { dryRun, from: pair.upperName, to: pair.lowerName });

  const assetResult = await runAssetBacksync(config, pair, dryRun, fetchImpl);

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  // Loaded AFTER runAssetBacksync so a newly-synced-down asset (or one
  // whose upper_asset_url just got backfilled) is available for
  // rewriteRefs below, in this same run.
  const assetMapping = await assetMappingStore.load();
  // `url` here is the LOWER environment's own CDN url (see
  // AssetMappingEntry.lower_asset_url's doc comment) — the document
  // being rewritten is moving TO the lower environment, so an Image
  // field's `url` must point at lower's own copy, not upper's.
  const reverseAssetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([lowerId, e]) => [
      e.upper_asset_id,
      { id: lowerId, url: e.lower_asset_url },
    ]),
  );

  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  const result: Phase4Result = {
    synced: 0,
    pending: 0,
    conflicts: [],
    deletedOnOneSide: [],
    assetsMigrated: assetResult.migrated,
    assetsSkipped: assetResult.skipped,
  };

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
      if (!lowerDoc || !upperDoc) {
        const deletedSide = !lowerDoc ? "lower" : "upper";
        result.deletedOnOneSide.push({
          lowerId,
          upperId: entry.upper_id,
          docType: entry.doc_type,
          deletedSide,
        });
        log("warn", "phase4.document_deleted", {
          lowerId,
          upperId: entry.upper_id,
          docType: entry.doc_type,
          deletedSide,
        });
        continue;
      }

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

  log("info", "phase4.done", {
    ...result,
    conflictCount: result.conflicts.length,
    deletedOnOneSideCount: result.deletedOnOneSide.length,
  });
  return result;
}
