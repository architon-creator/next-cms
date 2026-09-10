import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { listAssets, uploadAsset } from "../lib/prismic-http.js";
import type { AssetMapping } from "../types.js";

export type Phase1Options = {
  config: Config;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

/** Hash of the asset's own metadata — the closest proxy for "did this asset change" without re-downloading every file on every run. */
function assetContentHash(filename: string, size: number): string {
  return canonicalHash({ filename, size });
}

export async function runPhase1({
  config,
  dryRun,
  fetchImpl = fetch,
}: Phase1Options): Promise<void> {
  log("info", "phase1.start", { dryRun });

  const assetMappingStore = new MappingStore<AssetMapping>(
    join(config.mappingDir, "asset-mapping.json"),
  );
  const devAssets = await listAssets(config.dev, fetchImpl);
  log("info", "phase1.dev_assets_enumerated", { count: devAssets.length });

  let migrated = 0;
  let skipped = 0;
  let backfilled = 0;

  await assetMappingStore.mutate(async (mapping) => {
    // Backfill sit_url on entries from before it was recorded (an earlier
    // version of this codebase didn't store it) — without a real run,
    // rewriteRefs correctly rewrites `id` but not `url`, leaving migrated
    // documents permanently hot-linking to dev's CDN for their images.
    // Uses listAssets rather than re-uploading: the asset is already in
    // sit's library, so this only needs to look its URL up, not recreate
    // it (which would leave the old upload orphaned in sit's library).
    const needsBackfill = Object.values(mapping).some((entry) => !entry.sit_url);
    if (needsBackfill && !dryRun) {
      const sitAssetsById = new Map(
        (await listAssets(config.sit, fetchImpl)).map((a) => [a.id, a.url]),
      );
      for (const entry of Object.values(mapping)) {
        if (entry.sit_url) continue;
        const url = sitAssetsById.get(entry.sit_asset_id);
        if (url) {
          entry.sit_url = url;
          backfilled += 1;
        } else {
          log("warn", "phase1.backfill_asset_not_found", {
            sitAssetId: entry.sit_asset_id,
          });
        }
      }
    }

    for (const asset of devAssets) {
      const contentHash = assetContentHash(asset.filename, asset.size);
      const existing = mapping[asset.id];

      // Idempotency: an asset already migrated with an unchanged content
      // hash is skipped outright, never re-uploaded.
      if (existing && existing.dev_hash === contentHash) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        log("info", "phase1.would_upload", {
          devAssetId: asset.id,
          filename: asset.filename,
        });
        continue;
      }

      const downloaded = await fetchImpl(asset.url);
      if (!downloaded.ok) {
        log("error", "phase1.download_failed", {
          devAssetId: asset.id,
          status: downloaded.status,
        });
        continue;
      }
      const blob = await downloaded.blob();
      const uploaded = await uploadAsset(config.sit, blob, asset.filename, fetchImpl);

      mapping[asset.id] = {
        sit_asset_id: uploaded.id,
        sit_url: uploaded.url,
        dev_hash: contentHash,
        migrated_at: new Date().toISOString(),
      };
      migrated += 1;
      log("info", "phase1.asset_migrated", {
        devAssetId: asset.id,
        sitAssetId: uploaded.id,
      });
    }
    return mapping;
  });

  log("info", "phase1.done", { dryRun, migrated, skipped, backfilled });
}
