/**
 * Shared types for the Prismic environment-chain migration + back-sync
 * toolkit (dev -> sit -> uat -> prod, one adjacent hop at a time).
 *
 * The document mapping schema is generic per adjacent PAIR of
 * environments, not tied to "dev"/"sit" by name: one mapping file per
 * pair (e.g. dev-sit-mapping.json, sit-uat-mapping.json), keyed by the
 * LOWER environment's document id, with fields named for each pair's
 * fixed lower/upper roles rather than "source"/"target" — "source" and
 * "target" would flip meaning depending on whether a `migrate` (forward,
 * lower -> upper) or `backsync` (backward, upper -> lower) is the one
 * touching the file, since both directions share the same mapping file
 * for a given pair. "lower"/"upper" are fixed properties of the pair
 * itself, independent of which direction is currently running.
 *
 * Deliberately shaped so a later move to DynamoDB is a straight
 * loop-and-PutItem: PK: lower_id (the map key), SK: upper_id, plus a GSI
 * on upper_id and a GSI on status — every other attribute below maps 1:1
 * onto a DynamoDB item attribute. A `pair` attribute (e.g. "dev-sit")
 * would distinguish rows across different adjacent pairs sharing one
 * table, using these same generic column names throughout.
 */

export type SyncStatus = "synced" | "conflict" | "pending";
/** "forward" always means lower -> upper (a `migrate`); "backward" always means upper -> lower (a `backsync`). */
export type SyncDirection = "forward" | "backward";

export type MappingEntry = {
  upper_id: string;
  doc_type: string;
  uid?: string;
  lang?: string;
  /**
   * SHA-256 of the *raw* lower-environment document's `data` payload (see
   * lib/canonical-hash.ts), computed BEFORE any asset/link rewriting.
   * `backsync` re-derives this the same way from the lower side's current
   * state, so the two are only comparable if this one was captured
   * pre-rewrite too.
   */
  lower_hash: string;
  /** SHA-256 of the upper environment's `data` payload, same canonicalization, post-rewrite. */
  upper_hash: string;
  last_synced_at: string;
  last_synced_direction: SyncDirection;
  status: SyncStatus;
};

/** Keyed by the lower environment's document id — fixed regardless of sync direction. */
export type DocumentMapping = Record<string, MappingEntry>;

export type AssetMappingEntry = {
  upper_asset_id: string;
  /**
   * The upper environment's own CDN URL for the uploaded asset. Needed
   * alongside upper_asset_id because an Image field embeds both `id` and
   * `url` — rewriting `id` alone leaves the document's images permanently
   * hot-linking to the lower environment's CDN instead of the upper
   * environment's own uploaded copy. See lib/rewrite-refs.ts.
   */
  upper_asset_url: string;
  /**
   * The lower environment's own CDN URL for the asset — needed so
   * `backsync`'s asset step can rewrite an Image field's `url` (not just
   * `id`) when moving a document upper -> lower; using `upper_asset_url`
   * there would leave the now-lower-environment document hot-linking to
   * the upper environment's CDN instead. Optional because entries
   * created before this field existed don't have it — `rewriteRefs`
   * simply leaves `url` untouched when it's missing, which is the same
   * limitation `upper_asset_url` itself had before ITS own backfill
   * routine was added (see phase1-assets.ts) — a symmetric backfill
   * hasn't been built for this side yet.
   */
  lower_asset_url?: string;
  /**
   * Hash of the asset's own metadata (filename + size) — see
   * phase1-assets.ts. Always set equal to `upper_hash` at the moment an
   * entry is created (a migrated asset is a byte-for-byte copy, so its
   * filename/size are identical on both sides right after the copy);
   * they only diverge once one side's asset changes independently and
   * hasn't been re-synced yet — which is exactly what a re-sync in
   * either direction checks for, symmetric to MappingEntry's
   * lower_hash/upper_hash for documents.
   */
  lower_hash: string;
  /** Same idea as `lower_hash`, but for the upper environment's copy — lets `backsync`'s asset step detect an upper-originated or upper-changed asset without assuming the lower side is always the source of truth. */
  upper_hash: string;
  migrated_at: string;
};

/**
 * Keyed by the lower environment's asset id — whichever side an entry was
 * originally created from (a `assets` forward migration, or a `backsync`
 * asset pulled down because it only existed in the upper environment).
 */
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
