/**
 * Walks a Prismic document's `data` payload and rewrites embedded
 * references according to the given id maps. One function, reused in four
 * places:
 *
 *  - Phase 2 Pass 1: rewrite asset ids dev -> sit (both field shapes below).
 *  - Phase 2 Pass 2: rewrite document-link ids dev -> sit, once every dev
 *    doc has a sit_id (documentIds only becomes complete after Pass 1).
 *  - Phase 3: recompute what sit's data *should* look like from dev's raw
 *    data + the current mapping, to structurally compare against what sit
 *    actually has (a direct hash of raw dev vs. raw sit will never match,
 *    since sit's ids are rewritten — comparing rewrite(dev) vs sit is the
 *    correct check).
 *  - Phase 4: the same rewriter, run in reverse (sit -> dev), for back-sync.
 *
 * Two asset field shapes exist and are both handled, confirmed against a
 * real repository (`inspect <devId>` on a document whose migration was
 * failing "Assets not found" despite the assets already being uploaded —
 * the id was never being rewritten because this file didn't recognize
 * the shape yet):
 *
 *  - A "Link to Media" field: `{ link_type: "Media", id }`. This was the
 *    only shape originally assumed here — unverified at the time, and it
 *    turned out to be the LESS common one in practice.
 *  - A plain Image field: `{ dimensions, alt, copyright, url, id, edit }`
 *    — no `link_type` at all. This is what a real repository's Image
 *    fields actually look like, and the shape most documents here
 *    actually use. Detected by the combination of `id` + `url` +
 *    `dimensions` all being present, which nothing else in Prismic's data
 *    model produces together. Both `id` AND `url` are rewritten — `id`
 *    alone would leave the image permanently hot-linking to dev's CDN
 *    even after "migrating" to sit's own asset library.
 *
 * A "Content Relationship" field — `{ link_type: "Document", id }` — is
 * the one shape still unconfirmed against a real repository's response;
 * flagged in the README until it's been exercised for real.
 */
export type AssetRef = { id: string; url?: string };

export type RefMaps = {
  assetIds?: Record<string, AssetRef>;
  documentIds?: Record<string, string>;
};

export function rewriteRefs<T>(data: T, maps: RefMaps): T {
  return walk(data, maps) as T;
}

function isImageField(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.id === "string" &&
    typeof obj.url === "string" &&
    obj.dimensions !== null &&
    typeof obj.dimensions === "object"
  );
}

function walk(value: unknown, maps: RefMaps): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, maps));
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (obj.link_type === "Media" && typeof obj.id === "string") {
      const target = maps.assetIds?.[obj.id];
      if (target) {
        return { ...obj, id: target.id, ...(target.url ? { url: target.url } : {}) };
      }
    }

    if (isImageField(obj)) {
      const target = maps.assetIds?.[obj.id as string];
      if (target) {
        return { ...obj, id: target.id, ...(target.url ? { url: target.url } : {}) };
      }
    }

    if (
      obj.link_type === "Document" &&
      typeof obj.id === "string" &&
      maps.documentIds?.[obj.id]
    ) {
      return { ...obj, id: maps.documentIds[obj.id] };
    }

    const rewritten: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      rewritten[key] = walk(child, maps);
    }
    return rewritten;
  }

  return value;
}

/**
 * Strips read-time-derived metadata from link/asset fields before a
 * structural comparison — for Phase 3's spot-check ONLY, never for what's
 * actually written to sit.
 *
 * Confirmed via `inspect <devId> <sitId>` on a real "mismatch" the
 * spot-check flagged: a Content Relationship field comes back from
 * Prismic's content API denormalized with a live snapshot of the TARGET
 * document's own state — `type`, `tags`, `lang`, `slug`,
 * `first_publication_date`, `last_publication_date`, `isBroken` — none of
 * which this toolkit writes or controls; Prismic re-derives them at read
 * time from whichever document `id` currently points at. dev's copy and
 * sit's copy legitimately show different values here (different publish
 * dates, etc.) even when the migration is entirely correct, because
 * they're each hydrated from a different target in a different
 * repository. A raw hash comparison treats that as a mismatch; it isn't
 * one — the broken-link scan and asset check (which DO check the `id`
 * itself resolves to something real) are what actually catch a wrong
 * reference. Image fields likely have the same issue for `dimensions`/
 * `url`/`edit` (Prismic/asset-derived, not migration-controlled), so
 * they're normalized the same way, down to just `id`.
 */
export function normalizeForComparison<T>(data: T): T {
  return normalize(data) as T;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (
      (obj.link_type === "Document" || obj.link_type === "Media") &&
      typeof obj.id === "string"
    ) {
      return { link_type: obj.link_type, id: obj.id };
    }
    if (isImageField(obj)) {
      return { id: obj.id };
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      normalized[key] = normalize(child);
    }
    return normalized;
  }
  return value;
}

/**
 * Scans `data` for any Document-link `id` that isn't a key of `knownIds` —
 * used by Phase 3's broken-link scan (an id left over from before Pass 2
 * ran, or one that never resolved). Returns the offending ids, deduped.
 */
export function findUnresolvedDocumentLinks(
  data: unknown,
  knownIds: Set<string>,
): string[] {
  const found = new Set<string>();
  scanForUnresolved(data, knownIds, found);
  return [...found];
}

function scanForUnresolved(
  value: unknown,
  knownIds: Set<string>,
  found: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) scanForUnresolved(item, knownIds, found);
    return;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (
      obj.link_type === "Document" &&
      typeof obj.id === "string" &&
      !knownIds.has(obj.id)
    ) {
      found.add(obj.id);
    }
    for (const child of Object.values(obj)) scanForUnresolved(child, knownIds, found);
  }
}

/** Same idea as findUnresolvedDocumentLinks, but for asset references vs. sit's asset library — both field shapes rewriteRefs() handles. */
export function findUnresolvedAssetLinks(
  data: unknown,
  knownAssetIds: Set<string>,
): string[] {
  const found = new Set<string>();
  scanForUnresolvedAssets(data, knownAssetIds, found);
  return [...found];
}

function scanForUnresolvedAssets(
  value: unknown,
  knownAssetIds: Set<string>,
  found: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) scanForUnresolvedAssets(item, knownAssetIds, found);
    return;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const isMediaLink = obj.link_type === "Media" && typeof obj.id === "string";
    const isImage = isImageField(obj);
    if ((isMediaLink || isImage) && typeof obj.id === "string" && !knownAssetIds.has(obj.id)) {
      found.add(obj.id);
    }
    for (const child of Object.values(obj))
      scanForUnresolvedAssets(child, knownAssetIds, found);
  }
}
