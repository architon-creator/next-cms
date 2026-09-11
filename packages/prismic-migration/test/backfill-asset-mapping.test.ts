import { describe, expect, it } from "vitest";
import { backfillAssetMapping } from "../src/tools/backfill-asset-mapping.js";
import type { AssetMapping } from "../src/types.js";

// Regression coverage for the real failure mode this script exists to
// prevent: an AssetMappingEntry created before upper_hash existed (e.g.
// by migrate-legacy-mapping.ts's older version) would make backsync's
// asset step treat every already-migrated asset as brand new, uploading
// a duplicate copy of each one.

function entry(overrides: Partial<AssetMapping[string]> = {}): AssetMapping[string] {
  return {
    upper_asset_id: "sit-asset-1",
    upper_asset_url: "https://sit.cdn/hero.png",
    lower_hash: "hash-v1",
    upper_hash: "hash-v1",
    migrated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("backfillAssetMapping", () => {
  it("sets upper_hash to lower_hash on an entry missing it", () => {
    const mapping: AssetMapping = {
      "dev-asset-1": entry({ upper_hash: undefined as unknown as string }),
    };
    delete (mapping["dev-asset-1"] as Partial<AssetMapping[string]>).upper_hash;

    const result = backfillAssetMapping(mapping, new Map());

    expect(mapping["dev-asset-1"].upper_hash).toBe("hash-v1");
    expect(result.backfilledHash).toBe(1);
  });

  it("does not touch an entry that already has upper_hash", () => {
    const mapping: AssetMapping = {
      "dev-asset-1": entry({ upper_hash: "already-set" }),
    };

    const result = backfillAssetMapping(mapping, new Map());

    expect(mapping["dev-asset-1"].upper_hash).toBe("already-set");
    expect(result.backfilledHash).toBe(0);
  });

  it("backfills lower_asset_url from the provided lower-asset lookup", () => {
    const mapping: AssetMapping = {
      "dev-asset-1": entry(),
    };
    delete mapping["dev-asset-1"].lower_asset_url;

    const result = backfillAssetMapping(
      mapping,
      new Map([["dev-asset-1", "https://dev.cdn/hero.png"]]),
    );

    expect(mapping["dev-asset-1"].lower_asset_url).toBe("https://dev.cdn/hero.png");
    expect(result.backfilledUrl).toBe(1);
  });

  it("counts a missing lower asset rather than throwing, when the lookup has no entry for it", () => {
    const mapping: AssetMapping = {
      "dev-asset-1": entry(),
    };
    delete mapping["dev-asset-1"].lower_asset_url;

    const result = backfillAssetMapping(mapping, new Map());

    expect(mapping["dev-asset-1"].lower_asset_url).toBeUndefined();
    expect(result.backfilledUrl).toBe(0);
    expect(result.missingLowerAsset).toBe(1);
  });

  it("processes multiple entries independently in one pass", () => {
    const mapping: AssetMapping = {
      "dev-asset-1": entry({ upper_hash: "already-set" }),
      "dev-asset-2": entry(),
    };
    delete mapping["dev-asset-2"].upper_hash;

    const result = backfillAssetMapping(mapping, new Map());

    expect(mapping["dev-asset-1"].upper_hash).toBe("already-set");
    expect(mapping["dev-asset-2"].upper_hash).toBe("hash-v1");
    expect(result.backfilledHash).toBe(1);
  });
});
