import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { mappingFilePath } from "../lib/mapping-paths.js";
import { getDocumentById, getMasterRef } from "../lib/prismic-http.js";
import type { DocumentMapping } from "../types.js";

export type LinkOptions = {
  config: Config;
  pair: ResolvedPair;
  lowerId: string;
  upperId: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

/**
 * Manual escape hatch for exactly what `reconcile` can't do on its own:
 * link a lower-environment document to an upper-environment document
 * that the content API can't see (an unpublished draft, invisible
 * outside the master ref) — confirmed on a real run, where `reconcile`
 * reported zero matches for several non-repeatable types that `migrate`
 * had already proven exist in the upper environment.
 *
 * Requires the upper document's id to be supplied by hand (find it in
 * the upper environment's dashboard URL when the document is open).
 * Attempts to read the upper document's current data via getDocumentById
 * for a real `upper_hash` — but does NOT require it to succeed: if the
 * upper document is ALSO a draft (the whole reason this command exists),
 * that read fails the same way reconcile's did, and this proceeds
 * anyway with `upper_hash` left empty. That's safe because
 * `status: "conflict"` already excludes this entry from every automated
 * hash comparison downstream (`migrate` only compares `lower_hash`;
 * `backsync` only ever processes `status: "synced"` entries) — an
 * inaccurate or missing `upper_hash` on a conflict entry changes nothing
 * until a human resolves it.
 *
 * Same safety property as `reconcile`: never writes the lower document's
 * content into the upper one. Only records the link and marks it
 * `status: "conflict"` for later review.
 */
/** True if the link was made (or would be, under --dry-run); false if refused or a document couldn't be found. */
export async function runLink({
  config,
  pair,
  lowerId,
  upperId,
  dryRun,
  fetchImpl = fetch,
}: LinkOptions): Promise<boolean> {
  log("info", "link.start", { lowerId, upperId, dryRun });

  if (lowerId === upperId) {
    // Caught on a real run: the lower and upper environments are
    // different repositories with independently generated ids — the two
    // can never legitimately be the same value. This is virtually always
    // a copy-paste mistake (the lower id typed twice instead of the
    // actual upper id from the upper environment's dashboard URL), and
    // proceeding would silently record a mapping entry pointing at an id
    // that doesn't exist in the upper environment at all.
    log("error", "link.same_id_refused", {
      lowerId,
      upperId,
      hint: "lowerId and upperId are identical — did you mean to paste the upper document's own id from its dashboard URL instead?",
    });
    return false;
  }

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  const lowerDoc = await getDocumentById(pair.lower, lowerRef, lowerId, fetchImpl);
  if (!lowerDoc) {
    log("error", "link.lower_document_not_found", { lowerId });
    return false;
  }

  const upperDoc = await getDocumentById(pair.upper, upperRef, upperId, fetchImpl);
  if (!upperDoc) {
    log("warn", "link.upper_document_unreadable", {
      upperId,
      hint: "likely still an unpublished draft — linking anyway with an empty upper_hash; this entry is 'conflict' either way, so nothing downstream compares it until you resolve it by hand",
    });
  }

  if (dryRun) {
    log("info", "link.would_link", { lowerId, upperId, docType: lowerDoc.type });
    return true;
  }

  // Logged AFTER mutate() succeeds, not before — a mutate() failure (e.g.
  // a stale lock file from an interrupted earlier run) must not report
  // success for a write that never actually happened. Caught on a real
  // run: an earlier version of this logged "linked" first, so a lock
  // error right after made it look like the link had gone through when
  // the entry was never actually written.
  await mappingStore.mutate((mapping) => {
    mapping[lowerId] = {
      upper_id: upperId,
      doc_type: lowerDoc.type,
      uid: lowerDoc.uid || undefined,
      lang: lowerDoc.lang,
      lower_hash: canonicalHash(lowerDoc.data),
      upper_hash: upperDoc ? canonicalHash(upperDoc.data) : "",
      last_synced_at: new Date().toISOString(),
      last_synced_direction: "forward",
      // Same reasoning as reconcile: the lower document's content was
      // never written to this document, so flag it for review rather
      // than assume a match.
      status: "conflict",
    };
    return mapping;
  });

  log("info", "link.linked", { lowerId, upperId, docType: lowerDoc.type });
  return true;
}

export type UnlinkOptions = {
  config: Config;
  pair: ResolvedPair;
  lowerId: string;
  dryRun: boolean;
};

/**
 * Removes a lower document's mapping entry entirely — the undo for
 * `link` (or `reconcile`), for when the linked upper document turns out
 * to be worth discarding rather than keeping. Typical flow: delete the
 * document in the upper environment's dashboard, `unlink` its stale
 * mapping entry here, then run `migrate` again to create a fresh,
 * correct copy from the lower environment.
 *
 * Does not touch the upper environment at all — this only forgets the
 * mapping. If the upper document still exists and you run `migrate`
 * without deleting it first, you're back to the original "already
 * exist, non-repeatable" collision this was linked to get around.
 */
export async function runUnlink({
  config,
  pair,
  lowerId,
  dryRun,
}: UnlinkOptions): Promise<boolean> {
  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const mapping = await mappingStore.load();
  const entry = mapping[lowerId];

  if (!entry) {
    log("error", "unlink.not_mapped", { lowerId });
    return false;
  }

  if (dryRun) {
    log("info", "unlink.would_unlink", { lowerId, upperId: entry.upper_id });
    return true;
  }

  // Logged AFTER mutate() succeeds — see the matching comment in runLink.
  // Caught on a real run: this used to log "unlinked" before the write,
  // and a stale lock file from an interrupted earlier command made the
  // entry look removed when it never actually was.
  await mappingStore.mutate((current) => {
    delete current[lowerId];
    return current;
  });

  log("info", "unlink.unlinked", { lowerId, upperId: entry.upper_id });
  return true;
}
