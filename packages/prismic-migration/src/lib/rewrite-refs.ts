/**
 * Walks a Prismic document's `data` payload and rewrites embedded
 * references according to the given id maps. One function, reused in four
 * places:
 *
 *  - Phase 2 Pass 1: rewrite asset ("Link to Media") ids dev -> sit.
 *  - Phase 2 Pass 2: rewrite document-link ids dev -> sit, once every dev
 *    doc has a sit_id (documentIds only becomes complete after Pass 1).
 *  - Phase 3: recompute what sit's data *should* look like from dev's raw
 *    data + the current mapping, to structurally compare against what sit
 *    actually has (a direct hash of raw dev vs. raw sit will never match,
 *    since sit's ids are rewritten — comparing rewrite(dev) vs sit is the
 *    correct check).
 *  - Phase 4: the same rewriter, run in reverse (sit -> dev), for back-sync.
 *
 * ASSUMPTION TO VERIFY before relying on this against a real repository:
 * this targets the Prismic REST API v2 shape, where a "Link to Media" or
 * "Content Relationship" field is an object carrying `link_type`
 * ("Media" | "Document") and `id`. Confirm this against an actual response
 * from the target project's repositories — field shapes have shifted
 * across Prismic API versions and this has not been run against a live
 * Prismic repository.
 */
export type RefMaps = {
  assetIds?: Record<string, string>;
  documentIds?: Record<string, string>;
};

export function rewriteRefs<T>(data: T, maps: RefMaps): T {
  return walk(data, maps) as T;
}

function walk(value: unknown, maps: RefMaps): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, maps));
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (
      obj.link_type === "Media" &&
      typeof obj.id === "string" &&
      maps.assetIds?.[obj.id]
    ) {
      return { ...obj, id: maps.assetIds[obj.id] };
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

/** Same idea as findUnresolvedDocumentLinks, but for Media links vs. sit's asset library. */
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
    if (
      obj.link_type === "Media" &&
      typeof obj.id === "string" &&
      !knownAssetIds.has(obj.id)
    ) {
      found.add(obj.id);
    }
    for (const child of Object.values(obj))
      scanForUnresolvedAssets(child, knownAssetIds, found);
  }
}
