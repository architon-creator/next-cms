/**
 * Shared types for the Prismic dev -> sit migration + back-sync toolkit.
 *
 * The document mapping schema is deliberately shaped so a later move to
 * DynamoDB is a straight loop-and-PutItem: PK: dev_id, SK: sit_id, plus a
 * GSI on sit_id and a GSI on status — every other attribute below maps
 * 1:1 onto a DynamoDB item attribute.
 */

export type SyncStatus = "synced" | "conflict" | "pending";
export type SyncDirection = "dev->sit" | "sit->dev";

export type MappingEntry = {
  sit_id: string;
  doc_type: string;
  uid?: string;
  lang?: string;
  /**
   * SHA-256 of the *raw* dev document's `data` payload (see
   * lib/canonical-hash.ts), computed BEFORE any asset/link rewriting.
   * Back-sync re-derives this the same way from dev's current state, so the
   * two are only comparable if this one was captured pre-rewrite too.
   */
  dev_hash: string;
  /** SHA-256 of sit's `data` payload, same canonicalization, post-rewrite. */
  sit_hash: string;
  last_synced_at: string;
  last_synced_direction: SyncDirection;
  status: SyncStatus;
};

/** Keyed by dev document id. */
export type DocumentMapping = Record<string, MappingEntry>;

export type AssetMappingEntry = {
  sit_asset_id: string;
  /** Hash of the asset's own metadata (filename + size) — see phase1-assets.ts. */
  dev_hash: string;
  migrated_at: string;
};

/** Keyed by dev asset id. */
export type AssetMapping = Record<string, AssetMappingEntry>;

/** Minimal shape of a Prismic document as returned by the REST v2 API. */
export type PrismicDocument = {
  id: string;
  uid: string | null;
  type: string;
  lang: string;
  tags: string[];
  data: Record<string, unknown>;
};

export type PrismicAsset = {
  id: string;
  url: string;
  filename: string;
  size: number;
};

export type PrismicCustomType = {
  id: string;
  label: string;
  repeatable: boolean;
  status: boolean;
  json: unknown;
};
