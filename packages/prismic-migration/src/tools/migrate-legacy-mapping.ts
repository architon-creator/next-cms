#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../config.js";
import { assetMappingFilePath, mappingFilePath } from "../lib/mapping-paths.js";
import { MappingStore } from "../lib/mapping-store.js";
import type { AssetMapping, DocumentMapping, SyncDirection } from "../types.js";

loadDotenv();

/** Legacy (pre environment-chain) shape — dev/sit hardcoded, positional field names. */
type LegacyMappingEntry = {
  sit_id: string;
  doc_type: string;
  uid?: string;
  lang?: string;
  dev_hash: string;
  sit_hash: string;
  last_synced_at: string;
  last_synced_direction: "dev->sit" | "sit->dev";
  status: "synced" | "conflict" | "pending";
};
type LegacyMapping = Record<string, LegacyMappingEntry>;

type LegacyAssetMappingEntry = {
  sit_asset_id: string;
  sit_url?: string;
  dev_hash: string;
  migrated_at: string;
};
type LegacyAssetMapping = Record<string, LegacyAssetMappingEntry>;

function convertDirection(d: "dev->sit" | "sit->dev"): SyncDirection {
  return d === "dev->sit" ? "forward" : "backward";
}

/** Pure conversion, exported for direct unit testing — no filesystem or env access. */
export function convertLegacyMapping(legacy: LegacyMapping): DocumentMapping {
  const converted: DocumentMapping = {};
  for (const [devId, entry] of Object.entries(legacy)) {
    converted[devId] = {
      upper_id: entry.sit_id,
      doc_type: entry.doc_type,
      uid: entry.uid,
      lang: entry.lang,
      lower_hash: entry.dev_hash,
      upper_hash: entry.sit_hash,
      last_synced_at: entry.last_synced_at,
      last_synced_direction: convertDirection(entry.last_synced_direction),
      status: entry.status,
    };
  }
  return converted;
}

/** Pure conversion, exported for direct unit testing — no filesystem or env access. */
export function convertLegacyAssetMapping(legacy: LegacyAssetMapping): AssetMapping {
  const converted: AssetMapping = {};
  for (const [devAssetId, entry] of Object.entries(legacy)) {
    converted[devAssetId] = {
      upper_asset_id: entry.sit_asset_id,
      upper_asset_url: entry.sit_url ?? "",
      lower_hash: entry.dev_hash,
      migrated_at: entry.migrated_at,
    };
  }
  return converted;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * One-time upgrade for a mapping store built before the environment-chain
 * refactor (types.ts, this same commit series): renames the flat
 * data/mapping.json + data/asset-mapping.json (hardcoded dev/sit field
 * names: sit_id, dev_hash, sit_hash, sit_asset_id, sit_url) into the
 * pair-scoped dev-sit-mapping.json / dev-sit-asset-mapping.json files
 * with the new generic lower_/upper_ field names — the same shape every
 * other pair (sit-uat, uat-prod, ...) now uses.
 *
 * Deliberately conservative: refuses to run if the new-format files
 * already exist (never silently overwrites a mapping this tool's own
 * later commands may have already written to), and never deletes the
 * old files itself — leaves that for a human to do once `pnpm cli verify
 * --from=dev --to=sit` confirms the converted mapping is correct.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const legacyMappingPath = join(config.mappingDir, "mapping.json");
  const legacyAssetMappingPath = join(config.mappingDir, "asset-mapping.json");
  const newMappingPath = mappingFilePath(config.mappingDir, "dev", "sit");
  const newAssetMappingPath = assetMappingFilePath(config.mappingDir, "dev", "sit");

  const [hasLegacyMapping, hasLegacyAssetMapping] = await Promise.all([
    exists(legacyMappingPath),
    exists(legacyAssetMappingPath),
  ]);

  if (!hasLegacyMapping && !hasLegacyAssetMapping) {
    console.error(
      `Nothing to convert: neither ${legacyMappingPath} nor ${legacyAssetMappingPath} exists.`,
    );
    process.exitCode = 1;
    return;
  }

  const [hasNewMapping, hasNewAssetMapping] = await Promise.all([
    exists(newMappingPath),
    exists(newAssetMappingPath),
  ]);
  if (hasNewMapping || hasNewAssetMapping) {
    console.error(
      [
        "Refusing to run: the new-format mapping file(s) already exist:",
        hasNewMapping ? `  ${newMappingPath}` : undefined,
        hasNewAssetMapping ? `  ${newAssetMappingPath}` : undefined,
        "This tool only ever writes them once, to avoid clobbering mapping",
        "entries this toolkit's own commands may have already recorded there.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  if (hasLegacyMapping) {
    const legacy: LegacyMapping = JSON.parse(await readFile(legacyMappingPath, "utf8"));
    const converted = convertLegacyMapping(legacy);
    const mappingStore = new MappingStore<DocumentMapping>(newMappingPath);
    await mappingStore.mutate(() => converted);
    console.log(
      `Converted ${Object.keys(converted).length} document mapping entries: ${legacyMappingPath} -> ${newMappingPath}`,
    );
  }

  if (hasLegacyAssetMapping) {
    const legacy: LegacyAssetMapping = JSON.parse(
      await readFile(legacyAssetMappingPath, "utf8"),
    );
    const converted = convertLegacyAssetMapping(legacy);
    const assetMappingStore = new MappingStore<AssetMapping>(newAssetMappingPath);
    await assetMappingStore.mutate(() => converted);
    console.log(
      `Converted ${Object.keys(converted).length} asset mapping entries: ${legacyAssetMappingPath} -> ${newAssetMappingPath}`,
    );
  }

  console.log(
    [
      "",
      "Next steps:",
      "  1. pnpm cli verify --from=dev --to=sit    # confirm the converted mapping still checks out",
      "  2. Once satisfied, delete the old files by hand:",
      `       ${legacyMappingPath}`,
      `       ${legacyAssetMappingPath}`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
