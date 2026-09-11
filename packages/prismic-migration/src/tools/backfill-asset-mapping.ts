#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../config.js";
import { resolvePair } from "../lib/environments.js";
import { assetMappingFilePath } from "../lib/mapping-paths.js";
import { MappingStore } from "../lib/mapping-store.js";
import { listAssets } from "../lib/prismic-http.js";
import type { AssetMapping } from "../types.js";

loadDotenv();

function getFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

export type BackfillResult = {
  backfilledHash: number;
  backfilledUrl: number;
  missingLowerAsset: number;
};

/**
 * Pure mutation, exported for direct unit testing — no filesystem or
 * network access. Mutates `mapping` in place (matches MappingStore's own
 * mutate() callback convention) and reports what it did.
 */
export function backfillAssetMapping(
  mapping: AssetMapping,
  lowerAssetsById: Map<string, string>,
): BackfillResult {
  const result: BackfillResult = {
    backfilledHash: 0,
    backfilledUrl: 0,
    missingLowerAsset: 0,
  };

  for (const [lowerAssetId, entry] of Object.entries(mapping)) {
    if (!entry.upper_hash) {
      // A migrated asset is a byte-for-byte copy, so the upper side's
      // metadata hash was identical to the lower side's at the time it
      // was created — see the field's doc comment in types.ts.
      entry.upper_hash = entry.lower_hash;
      result.backfilledHash += 1;
    }
    if (!entry.lower_asset_url) {
      const url = lowerAssetsById.get(lowerAssetId);
      if (url) {
        entry.lower_asset_url = url;
        result.backfilledUrl += 1;
      } else {
        // The lower asset itself is gone — a pre-existing, separate
        // problem this script isn't responsible for fixing; `verify`
        // already surfaces this as a deletedAssets entry.
        result.missingLowerAsset += 1;
      }
    }
  }

  return result;
}

/**
 * One-time backfill for AssetMappingEntry fields added after some
 * entries were already created — `upper_hash` and `lower_asset_url` (see
 * types.ts for what each is for). Without `upper_hash`, `backsync`'s
 * asset step (runAssetBacksync in phase4-backsync.ts) treats every
 * already-migrated asset as brand new and re-uploads a duplicate copy of
 * each one into the lower environment — this is the concrete failure
 * mode this script exists to prevent. Safe to run repeatedly: only ever
 * fills in a MISSING field, never overwrites one that's already set.
 *
 * Typical trigger: a mapping file produced by `migrate-legacy-mapping`
 * before this session's asset-back-sync work added these fields.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fromName = getFlag(args, "from");
  const toName = getFlag(args, "to");
  if (!fromName || !toName) {
    console.error("Usage: pnpm backfill-asset-mapping --from=<env> --to=<env>");
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const pair = resolvePair(config, fromName, toName);
  const path = assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName);
  const store = new MappingStore<AssetMapping>(path);

  const lowerAssetsById = new Map(
    (await listAssets(pair.lower)).map((a) => [a.id, a.url]),
  );

  let result: BackfillResult = {
    backfilledHash: 0,
    backfilledUrl: 0,
    missingLowerAsset: 0,
  };
  await store.mutate((mapping) => {
    result = backfillAssetMapping(mapping, lowerAssetsById);
    return mapping;
  });

  console.log(
    [
      `Backfilled upper_hash on ${result.backfilledHash} entries.`,
      `Backfilled lower_asset_url on ${result.backfilledUrl} entries.`,
      result.missingLowerAsset > 0
        ? `${result.missingLowerAsset} entries could not get lower_asset_url — their lower asset no longer exists (run \`pnpm cli verify --from=${pair.lowerName} --to=${pair.upperName}\` to see them under deletedAssets).`
        : undefined,
      `File: ${path}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
