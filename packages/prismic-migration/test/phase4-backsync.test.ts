import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalHash } from "../src/lib/canonical-hash.js";
import { resolvePair } from "../src/lib/environments.js";
import { assetMappingFilePath, mappingFilePath } from "../src/lib/mapping-paths.js";
import { MappingStore } from "../src/lib/mapping-store.js";
import { runAssetBacksync, runPhase4 } from "../src/phases/phase4-backsync.js";
import type { Config } from "../src/config.js";
import type { AssetMapping, DocumentMapping } from "../src/types.js";

// Regression coverage for the "silently skips a deleted document" known
// gap: a mapping entry marked "synced" whose lower or upper document was
// deleted directly in a dashboard used to fall through a bare `continue`
// with no log line and no trace in the result.

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

describe("runPhase4 — deleted-document detection", () => {
  let dir: string;
  let config: Config;
  let pair: ReturnType<typeof resolvePair>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phase4-"));
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

  it("flags a synced entry whose upper document was deleted, without touching an intact entry", async () => {
    const intactData = { title: "Homepage" };
    const intactHash = canonicalHash(intactData);

    const mapping: DocumentMapping = {
      "dev-intact": {
        upper_id: "sit-intact",
        doc_type: "homepage",
        lower_hash: intactHash,
        upper_hash: intactHash,
        last_synced_at: "2026-01-01T00:00:00.000Z",
        last_synced_direction: "forward",
        status: "synced",
      },
      "dev-deleted": {
        upper_id: "sit-deleted",
        doc_type: "article",
        lower_hash: "some-hash",
        upper_hash: "some-hash",
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
        const q = url.searchParams.get("q") ?? "";
        if (q.includes("dev-intact")) {
          return searchResponse({
            id: "dev-intact",
            uid: null,
            type: "homepage",
            lang: "en-us",
            tags: [],
            data: intactData,
          });
        }
        if (q.includes("sit-intact")) {
          return searchResponse({
            id: "sit-intact",
            uid: null,
            type: "homepage",
            lang: "en-us",
            tags: [],
            data: intactData,
          });
        }
        if (q.includes("dev-deleted")) {
          return searchResponse({
            id: "dev-deleted",
            uid: null,
            type: "article",
            lang: "en-us",
            tags: [],
            data: { title: "Still here in dev" },
          });
        }
        if (q.includes("sit-deleted")) {
          return searchResponse(null); // deleted in sit
        }
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const result = await runPhase4({ config, pair, dryRun: false, fetchImpl });

    expect(result.deletedOnOneSide).toEqual([
      {
        lowerId: "dev-deleted",
        upperId: "sit-deleted",
        docType: "article",
        deletedSide: "upper",
      },
    ]);
    expect(result.conflicts).toEqual([]);
    expect(result.synced).toBe(0); // the intact entry hashes matched -> noop, no write
    expect(result.pending).toBe(0);
  });
});

// Regression coverage for the "asset back-sync isn't implemented" known
// gap: an asset uploaded fresh in the upper environment (or changed
// there) used to have no path down to the lower environment at all.
describe("runAssetBacksync", () => {
  let dir: string;
  let config: Config;
  let pair: ReturnType<typeof resolvePair>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phase4-assets-"));
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

  it("downloads and uploads an upper asset that has no mapping entry yet", async () => {
    const fetchImpl = async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname === "/assets" && (!init || init.method !== "POST")) {
        return jsonResponse({
          items: [
            {
              id: "sit-asset-1",
              url: "https://sit.cdn/hero.png",
              filename: "hero.png",
              size: 1024,
            },
          ],
          cursor: null,
        });
      }
      if (url.pathname === "/hero.png") {
        return new Response("fake-bytes", { status: 200 });
      }
      if (url.pathname === "/assets" && init?.method === "POST") {
        return jsonResponse({
          id: "dev-asset-1",
          url: "https://dev.cdn/hero.png",
          filename: "hero.png",
          size: 1024,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const result = await runAssetBacksync(config, pair, false, fetchImpl as typeof fetch);

    expect(result).toEqual({ migrated: 1, skipped: 0 });

    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    const mapping = await assetMappingStore.load();
    expect(mapping["dev-asset-1"]).toMatchObject({
      upper_asset_id: "sit-asset-1",
      upper_asset_url: "https://sit.cdn/hero.png",
      lower_asset_url: "https://dev.cdn/hero.png",
    });
    expect(mapping["dev-asset-1"].lower_hash).toBe(mapping["dev-asset-1"].upper_hash);
  });

  it("skips an upper asset already migrated down with an unchanged content hash", async () => {
    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    const hash = canonicalHash({ filename: "hero.png", size: 1024 });
    await assetMappingStore.mutate(() => ({
      "dev-asset-1": {
        upper_asset_id: "sit-asset-1",
        upper_asset_url: "https://sit.cdn/hero.png",
        lower_asset_url: "https://dev.cdn/hero.png",
        lower_hash: hash,
        upper_hash: hash,
        migrated_at: "2026-01-01T00:00:00.000Z",
      },
    }));

    const fetchImpl = async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/assets") {
        return jsonResponse({
          items: [
            {
              id: "sit-asset-1",
              url: "https://sit.cdn/hero.png",
              filename: "hero.png",
              size: 1024,
            },
          ],
          cursor: null,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const result = await runAssetBacksync(config, pair, false, fetchImpl);

    expect(result).toEqual({ migrated: 0, skipped: 1 });
  });

  it("does not write anything under --dry-run", async () => {
    const fetchImpl = async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/assets") {
        return jsonResponse({
          items: [
            {
              id: "sit-asset-1",
              url: "https://sit.cdn/hero.png",
              filename: "hero.png",
              size: 1024,
            },
          ],
          cursor: null,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    };

    const result = await runAssetBacksync(config, pair, true, fetchImpl);

    expect(result).toEqual({ migrated: 0, skipped: 0 });
    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    expect(await assetMappingStore.load()).toEqual({});
  });
});
