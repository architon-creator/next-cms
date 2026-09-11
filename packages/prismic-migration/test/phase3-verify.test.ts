import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePair } from "../src/lib/environments.js";
import { assetMappingFilePath, mappingFilePath } from "../src/lib/mapping-paths.js";
import { MappingStore } from "../src/lib/mapping-store.js";
import { runPhase3 } from "../src/phases/phase3-verify.js";
import type { Config } from "../src/config.js";
import type { AssetMapping, DocumentMapping } from "../src/types.js";

// Regression coverage for the "silently skips a deleted document" known
// gap: a "synced" entry whose upper document was deleted used to fall
// through a bare `continue` in the broken-link/asset-check loop with no
// trace anywhere in the report, and `passed` could still come back true.

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fakeMasterRefResponse(): Response {
  return jsonResponse({ refs: [{ ref: "master-ref", isMasterRef: true }] });
}

function searchResponse(doc: unknown | null): Response {
  return jsonResponse({ results: doc ? [doc] : [], next_page: null });
}

describe("runPhase3 — deleted-document detection", () => {
  let dir: string;
  let config: Config;
  let pair: ReturnType<typeof resolvePair>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phase3-"));
    config = {
      environments: {
        dev: { repository: "dev-repo", migrationToken: "dev-token" },
        sit: { repository: "sit-repo", migrationToken: "sit-token" },
      },
      environmentChain: ["dev", "sit"],
      mappingDir: join(dir, "data"),
      snapshotDir: join(dir, "snapshots"),
      reportDir: join(dir, "reports"),
      cacheDir: join(dir, "cache"),
    };
    pair = resolvePair(config, "dev", "sit");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("fails verification and reports a deleted upper document, even outside the spot-check sample", async () => {
    const mapping: DocumentMapping = {
      "dev-deleted": {
        upper_id: "sit-deleted",
        doc_type: "article",
        lower_hash: "h1",
        upper_hash: "h2",
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "forward",
        status: "synced",
      },
    };
    const mappingStore = new MappingStore<DocumentMapping>(
      mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    await mappingStore.mutate(() => mapping);

    const fetchImpl = async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/api/v2") return fakeMasterRefResponse();
      if (url.pathname === "/assets") return jsonResponse({ items: [], cursor: null });
      if (url.pathname === "/api/v2/documents/search") {
        const q = url.searchParams.get("q");
        if (q === null) {
          // iterateAllDocuments' count-check pass — no `q` param at all.
          const page = url.searchParams.get("page");
          if (page === "1") {
            return jsonResponse({
              results: [
                {
                  id: "dev-deleted",
                  uid: null,
                  type: "article",
                  lang: "en-us",
                  tags: [],
                  data: {},
                },
              ],
              next_page: null,
            });
          }
          return jsonResponse({ results: [], next_page: null });
        }
        if (q.includes("dev-deleted")) {
          return searchResponse({
            id: "dev-deleted",
            uid: null,
            type: "article",
            lang: "en-us",
            tags: [],
            data: {},
          });
        }
        if (q.includes("sit-deleted")) {
          return searchResponse(null); // deleted in sit
        }
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    // sampleSize: 0 so the spot-check itself doesn't touch this entry —
    // confirms the broken-link/asset-check loop (which iterates ALL
    // synced entries) is what catches the deletion, not just the sample.
    const report = await runPhase3({ config, pair, sampleSize: 0, fetchImpl });

    expect(report.deletedDocuments).toEqual([
      { lowerId: "dev-deleted", upperId: "sit-deleted", deletedSide: "upper" },
    ]);
    expect(report.passed).toBe(false);
  });
});

// Regression coverage for the "asset deletions still out of scope" known
// gap: a migrated asset that's since been deleted from the upper
// environment's library, with no document currently referencing it,
// used to have nothing at all to flag it — assetCheck only ever looked
// for a broken reference INSIDE a document's data.
describe("runPhase3 — deleted-asset detection", () => {
  let dir: string;
  let config: Config;
  let pair: ReturnType<typeof resolvePair>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phase3-assets-"));
    config = {
      environments: {
        dev: { repository: "dev-repo", migrationToken: "dev-token" },
        sit: { repository: "sit-repo", migrationToken: "sit-token" },
      },
      environmentChain: ["dev", "sit"],
      mappingDir: join(dir, "data"),
      snapshotDir: join(dir, "snapshots"),
      reportDir: join(dir, "reports"),
      cacheDir: join(dir, "cache"),
    };
    pair = resolvePair(config, "dev", "sit");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("fails verification and reports a migrated asset no longer present in the upper library", async () => {
    const assetMapping: AssetMapping = {
      "dev-asset-1": {
        upper_asset_id: "sit-asset-1",
        upper_asset_url: "https://sit.cdn/hero.png",
        lower_asset_url: "https://dev.cdn/hero.png",
        lower_hash: "h1",
        upper_hash: "h1",
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    };
    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    await assetMappingStore.mutate(() => assetMapping);

    const fetchImpl = async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/api/v2") return fakeMasterRefResponse();
      // The upper library no longer contains sit-asset-1 — deleted there.
      if (url.pathname === "/assets") return jsonResponse({ items: [], cursor: null });
      if (url.pathname === "/api/v2/documents/search") {
        return jsonResponse({ results: [], next_page: null });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const report = await runPhase3({ config, pair, fetchImpl });

    expect(report.deletedAssets).toEqual([
      { lowerAssetId: "dev-asset-1", upperAssetId: "sit-asset-1" },
    ]);
    expect(report.passed).toBe(false);
  });

  it("does not flag an asset that's still present in the upper library", async () => {
    const assetMapping: AssetMapping = {
      "dev-asset-1": {
        upper_asset_id: "sit-asset-1",
        upper_asset_url: "https://sit.cdn/hero.png",
        lower_asset_url: "https://dev.cdn/hero.png",
        lower_hash: "h1",
        upper_hash: "h1",
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    };
    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    await assetMappingStore.mutate(() => assetMapping);

    const fetchImpl = async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/api/v2") return fakeMasterRefResponse();
      if (url.pathname === "/assets") {
        return jsonResponse({
          items: [
            {
              id: "sit-asset-1",
              url: "https://sit.cdn/hero.png",
              filename: "hero.png",
              size: 1,
            },
          ],
          cursor: null,
        });
      }
      if (url.pathname === "/api/v2/documents/search") {
        return jsonResponse({ results: [], next_page: null });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const report = await runPhase3({ config, pair, fetchImpl });

    expect(report.deletedAssets).toEqual([]);
  });
});
