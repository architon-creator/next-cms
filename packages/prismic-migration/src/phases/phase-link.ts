import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { getDocumentById, getMasterRef } from "../lib/prismic-http.js";
import type { DocumentMapping } from "../types.js";

export type LinkOptions = {
  config: Config;
  devId: string;
  sitId: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

/**
 * Manual escape hatch for exactly what `reconcile` can't do on its own:
 * link a dev document to a sit document that the content API can't see
 * (an unpublished draft, invisible outside the master ref) — confirmed
 * on a real run, where `reconcile` reported zero matches for several
 * non-repeatable types that `migrate` had already proven exist in sit.
 *
 * Requires the sit document's id to be supplied by hand (find it in the
 * sit dashboard's URL when the document is open). Attempts to read sit's
 * current data via getDocumentById for a real `sit_hash` — but does NOT
 * require it to succeed: if sit's document is ALSO a draft (the whole
 * reason this command exists), that read fails the same way reconcile's
 * did, and this proceeds anyway with `sit_hash` left empty. That's safe
 * because `status: "conflict"` already excludes this entry from every
 * automated hash comparison downstream (`migrate` only compares
 * `dev_hash`; `backsync` only ever processes `status: "synced"` entries)
 * — an inaccurate or missing `sit_hash` on a conflict entry changes
 * nothing until a human resolves it.
 *
 * Same safety property as `reconcile`: never writes dev's content into
 * sit. Only records the link and marks it `status: "conflict"` for
 * later review.
 */
/** True if the link was made (or would be, under --dry-run); false if refused or a document couldn't be found. */
export async function runLink({
  config,
  devId,
  sitId,
  dryRun,
  fetchImpl = fetch,
}: LinkOptions): Promise<boolean> {
  log("info", "link.start", { devId, sitId, dryRun });

  if (devId === sitId) {
    // Caught on a real run: dev and sit are different repositories with
    // independently generated ids — the two can never legitimately be
    // the same value. This is virtually always a copy-paste mistake (the
    // dev id typed twice instead of the actual sit id from the sit
    // dashboard's URL), and proceeding would silently record a mapping
    // entry pointing at an id that doesn't exist in sit at all.
    log("error", "link.same_id_refused", {
      devId,
      sitId,
      hint: "devId and sitId are identical — did you mean to paste the sit document's own id from its dashboard URL instead?",
    });
    return false;
  }

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const devRef = await getMasterRef(config.dev, fetchImpl);
  const sitRef = await getMasterRef(config.sit, fetchImpl);

  const devDoc = await getDocumentById(config.dev, devRef, devId, fetchImpl);
  if (!devDoc) {
    log("error", "link.dev_document_not_found", { devId });
    return false;
  }

  const sitDoc = await getDocumentById(config.sit, sitRef, sitId, fetchImpl);
  if (!sitDoc) {
    log("warn", "link.sit_document_unreadable", {
      sitId,
      hint: "likely still an unpublished draft — linking anyway with an empty sit_hash; this entry is 'conflict' either way, so nothing downstream compares it until you resolve it by hand",
    });
  }

  if (dryRun) {
    log("info", "link.would_link", { devId, sitId, docType: devDoc.type });
    return true;
  }

  // Logged AFTER mutate() succeeds, not before — a mutate() failure (e.g.
  // a stale lock file from an interrupted earlier run) must not report
  // success for a write that never actually happened. Caught on a real
  // run: an earlier version of this logged "linked" first, so a lock
  // error right after made it look like the link had gone through when
  // the entry was never actually written.
  await mappingStore.mutate((mapping) => {
    mapping[devId] = {
      sit_id: sitId,
      doc_type: devDoc.type,
      uid: devDoc.uid || undefined,
      lang: devDoc.lang,
      dev_hash: canonicalHash(devDoc.data),
      sit_hash: sitDoc ? canonicalHash(sitDoc.data) : "",
      last_synced_at: new Date().toISOString(),
      last_synced_direction: "dev->sit",
      // Same reasoning as reconcile: dev's content was never written to
      // this document, so flag it for review rather than assume a match.
      status: "conflict",
    };
    return mapping;
  });

  log("info", "link.linked", { devId, sitId, docType: devDoc.type });
  return true;
}

export type UnlinkOptions = {
  config: Config;
  devId: string;
  dryRun: boolean;
};

/**
 * Removes a dev document's mapping entry entirely — the undo for `link`
 * (or `reconcile`), for when the linked sit document turns out to be
 * worth discarding rather than keeping. Typical flow: delete the
 * document in sit's dashboard, `unlink` its stale mapping entry here,
 * then run `migrate` again to create a fresh, correct copy from dev.
 *
 * Does not touch sit at all — this only forgets the mapping. If the sit
 * document still exists and you run `migrate` without deleting it first,
 * you're back to the original "already exist, non-repeatable" collision
 * this was linked to get around.
 */
export async function runUnlink({
  config,
  devId,
  dryRun,
}: UnlinkOptions): Promise<boolean> {
  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const mapping = await mappingStore.load();
  const entry = mapping[devId];

  if (!entry) {
    log("error", "unlink.not_mapped", { devId });
    return false;
  }

  if (dryRun) {
    log("info", "unlink.would_unlink", { devId, sitId: entry.sit_id });
    return true;
  }

  // Logged AFTER mutate() succeeds — see the matching comment in runLink.
  // Caught on a real run: this used to log "unlinked" before the write,
  // and a stale lock file from an interrupted earlier command made the
  // entry look removed when it never actually was.
  await mappingStore.mutate((current) => {
    delete current[devId];
    return current;
  });

  log("info", "unlink.unlinked", { devId, sitId: entry.sit_id });
  return true;
}
