import type { Config } from "../config.js";
import type { ResolvedPair } from "../lib/environments.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { assetMappingFilePath } from "../lib/mapping-paths.js";
import { listAssets, uploadAsset } from "../lib/prismic-http.js";
import type { AssetMapping } from "../types.js";

export type Phase1Options = {
  config: Config;
  pair: ResolvedPair;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

/** Hash of the asset's own metadata — the closest proxy for "did this asset change" without re-downloading every file on every run. */
function assetContentHash(filename: string, size: number): string {
  return canonicalHash({ filename, size });
}

export async function runPhase1({
  config,
  pair,
  dryRun,
  fetchImpl = fetch,
}: Phase1Options): Promise<void> {
  log("info", "phase1.start", { dryRun, from: pair.lowerName, to: pair.upperName });

  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const lowerAssets = await listAssets(pair.lower, fetchImpl);
  log("info", "phase1.lower_assets_enumerated", { count: lowerAssets.length });

  let migrated = 0;
  let skipped = 0;
  let backfilled = 0;

  await assetMappingStore.mutate(async (mapping) => {
    // Backfill upper_asset_url on entries from before it was recorded (an
    // earlier version of this codebase didn't store it) — without it,
    // rewriteRefs correctly rewrites `id` but not `url`, leaving migrated
    // documents permanently hot-linking to the lower environment's CDN
    // for their images. Uses listAssets rather than re-uploading: the
    // asset is already in the upper environment's library, so this only
    // needs to look its URL up, not recreate it (which would leave the
    // old upload orphaned in the upper library).
    const needsBackfill = Object.values(mapping).some((entry) => !entry.upper_asset_url);
    if (needsBackfill && !dryRun) {
      const upperAssetsById = new Map(
        (await listAssets(pair.upper, fetchImpl)).map((a) => [a.id, a.url]),
      );
      for (const entry of Object.values(mapping)) {
        if (entry.upper_asset_url) continue;
        const url = upperAssetsById.get(entry.upper_asset_id);
        if (url) {
          entry.upper_asset_url = url;
          backfilled += 1;
        } else {
          log("warn", "phase1.backfill_asset_not_found", {
            upperAssetId: entry.upper_asset_id,
          });
        }
      }
    }

    for (const asset of lowerAssets) {
      const contentHash = assetContentHash(asset.filename, asset.size);
      const existing = mapping[asset.id];

      // Idempotency: an asset already migrated with an unchanged content
      // hash is skipped outright, never re-uploaded.
      if (existing && existing.lower_hash === contentHash) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        log("info", "phase1.would_upload", {
          lowerAssetId: asset.id,
          filename: asset.filename,
        });
        continue;
      }

      const downloaded = await fetchImpl(asset.url);
      if (!downloaded.ok) {
        log("error", "phase1.download_failed", {
          lowerAssetId: asset.id,
          status: downloaded.status,
        });
        continue;
      }
      const blob = await downloaded.blob();
      const uploaded = await uploadAsset(pair.upper, blob, asset.filename, fetchImpl);

      mapping[asset.id] = {
        upper_asset_id: uploaded.id,
        upper_asset_url: uploaded.url,
        lower_hash: contentHash,
        migrated_at: new Date().toISOString(),
      };
      migrated += 1;
      log("info", "phase1.asset_migrated", {
        lowerAssetId: asset.id,
        upperAssetId: uploaded.id,
        filename: asset.filename,
      });
    }
    return mapping;
  });

  log("info", "phase1.done", { dryRun, migrated, skipped, backfilled });
}
