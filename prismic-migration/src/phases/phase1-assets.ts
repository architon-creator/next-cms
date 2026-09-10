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

  await assetMappingStore.mutate(async (mapping) => {
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

  log("info", "phase1.done", { dryRun, migrated, skipped });
}
