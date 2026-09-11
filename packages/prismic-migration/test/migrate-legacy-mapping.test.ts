import { describe, expect, it } from "vitest";
import {
  convertLegacyAssetMapping,
  convertLegacyMapping,
} from "../src/tools/migrate-legacy-mapping.js";

describe("convertLegacyMapping", () => {
  it("renames sit_id/dev_hash/sit_hash to upper_id/lower_hash/upper_hash", () => {
    const converted = convertLegacyMapping({
      "dev-doc-1": {
        sit_id: "sit-doc-1",
        doc_type: "homepage",
        uid: "home",
        lang: "en-us",
        dev_hash: "dev-hash-v1",
        sit_hash: "sit-hash-v1",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "dev->sit",
        status: "synced",
      },
    });

    expect(converted).toEqual({
      "dev-doc-1": {
        upper_id: "sit-doc-1",
        doc_type: "homepage",
        uid: "home",
        lang: "en-us",
        lower_hash: "dev-hash-v1",
        upper_hash: "sit-hash-v1",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "forward",
        status: "synced",
      },
    });
  });

  it("converts last_synced_direction 'sit->dev' to 'backward'", () => {
    const converted = convertLegacyMapping({
      "dev-doc-1": {
        sit_id: "sit-doc-1",
        doc_type: "homepage",
        dev_hash: "h1",
        sit_hash: "h2",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "sit->dev",
        status: "synced",
      },
    });

    expect(converted["dev-doc-1"].last_synced_direction).toBe("backward");
  });

  it("preserves entries with no uid/lang without inventing values", () => {
    const converted = convertLegacyMapping({
      "dev-doc-1": {
        sit_id: "sit-doc-1",
        doc_type: "homepage",
        dev_hash: "h1",
        sit_hash: "h2",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "dev->sit",
        status: "conflict",
      },
    });

    expect(converted["dev-doc-1"].uid).toBeUndefined();
    expect(converted["dev-doc-1"].lang).toBeUndefined();
    expect(converted["dev-doc-1"].status).toBe("conflict");
  });

  it("converts multiple entries independently, keyed by the same dev id", () => {
    const converted = convertLegacyMapping({
      "dev-doc-1": {
        sit_id: "sit-doc-1",
        doc_type: "homepage",
        dev_hash: "h1",
        sit_hash: "h2",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "dev->sit",
        status: "synced",
      },
      "dev-doc-2": {
        sit_id: "sit-doc-2",
        doc_type: "article",
        dev_hash: "h3",
        sit_hash: "h4",
        last_synced_at: "2026-01-02T00:00:00.000Z",
        last_synced_direction: "sit->dev",
        status: "pending",
      },
    });

    expect(Object.keys(converted)).toEqual(["dev-doc-1", "dev-doc-2"]);
    expect(converted["dev-doc-2"].upper_id).toBe("sit-doc-2");
    expect(converted["dev-doc-2"].last_synced_direction).toBe("backward");
  });
});

describe("convertLegacyAssetMapping", () => {
  it("renames sit_asset_id/sit_url/dev_hash to upper_asset_id/upper_asset_url/lower_hash", () => {
    const converted = convertLegacyAssetMapping({
      "dev-asset-1": {
        sit_asset_id: "sit-asset-1",
        sit_url: "https://sit.cdn/example.png",
        dev_hash: "asset-hash-v1",
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(converted).toEqual({
      "dev-asset-1": {
        upper_asset_id: "sit-asset-1",
        upper_asset_url: "https://sit.cdn/example.png",
        lower_hash: "asset-hash-v1",
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("defaults upper_asset_url to '' when the legacy entry predates url tracking", () => {
    const converted = convertLegacyAssetMapping({
      "dev-asset-1": {
        sit_asset_id: "sit-asset-1",
        dev_hash: "asset-hash-v1",
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(converted["dev-asset-1"].upper_asset_url).toBe("");
  });
});
