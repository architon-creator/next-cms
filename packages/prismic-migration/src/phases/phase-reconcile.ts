import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import {
  findDocumentsByType,
  getMasterRef,
  iterateAllDocuments,
  listCustomTypes,
  PrismicApiError,
} from "../lib/prismic-http.js";
import type { DocumentMapping } from "../types.js";

export type ReconcileOptions = {
  config: Config;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type ReconcileResult = {
  reconciled: number;
  ambiguous: { devId: string; docType: string; lang: string; matchCount: number }[];
  /**
   * Non-repeatable, but the content API found zero matching sit documents —
   * this happens when the pre-existing sit document is itself an
   * unpublished draft (the content API only sees the master ref, never
   * drafts), which `migrate`'s "already exist" error will still confirm.
   * Nothing automated can resolve these: find the document's id in the
   * sit dashboard and add it to mapping.json by hand (or wire up a manual
   * `link <devId> <sitId>` command if this becomes a recurring need).
   */
  notFound: { devId: string; docType: string; lang: string }[];
  /**
   * A findDocumentsByType call itself threw (network error, an API 4xx
   * like the query-syntax bug this codebase already hit once) — recorded
   * rather than thrown, for the same reason phase2-migrate.ts's per-
   * document try/catch exists: one document's failure must not abort the
   * whole mappingStore.mutate() callback, which would otherwise silently
   * discard every successful reconciliation this run already made before
   * the failure (mutate() only persists if its callback returns normally).
   */
  failed: { devId: string; docType: string; message: string; status?: number; body?: string }[];
};

/**
 * Links dev documents to a pre-existing sit document for the same
 * non-repeatable custom type — the gap Phase 0's own text names ("seeded
 * if any documents were manually created in sit already") but never
 * built tooling for, and which a real run made unavoidable: 16 of 17
 * `migrate` failures in one run were exactly this — a real sit
 * environment that already had content for every singleton page type
 * before this tool ever ran, none of it recorded in mapping.json, so
 * every create attempt collided with Prismic's non-repeatable
 * constraint.
 *
 * Deliberately narrow in scope: only handles non-repeatable types (where
 * "exactly one document of this type already exists" is an unambiguous
 * match — there's nothing else it could be). Does NOT attempt to
 * reconcile repeatable types by uid; a repeatable type can have many
 * pre-existing sit documents, and guessing which one corresponds to a
 * given dev document is a different, harder problem this doesn't solve.
 *
 * Deliberately does not write dev's content into the matched sit
 * document — rule #1 (never overwrite without a hash comparison) means
 * this only ever links dev_id -> the existing sit_id, marks the entry
 * `status: "conflict"`, and leaves reconciling the actual content
 * difference (if any) to a human, or to `backsync`'s conflict handling.
 * The upside: `migrate` stops trying to create a duplicate every run.
 */
export async function runReconcile({
  config,
  dryRun,
  fetchImpl = fetch,
}: ReconcileOptions): Promise<ReconcileResult> {
  log("info", "reconcile.start", { dryRun });

  const mappingStore = new MappingStore<DocumentMapping>(join(config.mappingDir, "mapping.json"));
  const devRef = await getMasterRef(config.dev, fetchImpl);
  const sitRef = await getMasterRef(config.sit, fetchImpl);

  const sitCustomTypes = await listCustomTypes(config.sit, fetchImpl);
  const nonRepeatableTypes = new Set(
    sitCustomTypes.filter((t) => !t.repeatable).map((t) => t.id),
  );

  const result: ReconcileResult = { reconciled: 0, ambiguous: [], notFound: [], failed: [] };

  await mappingStore.mutate(async (mapping) => {
    for await (const doc of iterateAllDocuments(config.dev, devRef, fetchImpl)) {
      if (mapping[doc.id]) continue; // already linked — nothing to reconcile
      if (!nonRepeatableTypes.has(doc.type)) continue; // out of scope, see doc comment above

      try {
        const matches = await findDocumentsByType(config.sit, sitRef, doc.type, doc.lang, fetchImpl);

        if (matches.length === 0) {
          // The content API (master-ref only) can't see an unpublished
          // draft — this is NOT "nothing to reconcile", it's "reconcile
          // can't see it". migrate will keep failing on this one until
          // it's linked by hand.
          result.notFound.push({ devId: doc.id, docType: doc.type, lang: doc.lang });
          log("warn", "reconcile.not_found", { devId: doc.id, docType: doc.type, lang: doc.lang });
          continue;
        }

        if (matches.length > 1) {
          // Shouldn't be possible for a genuinely non-repeatable type per
          // locale, but if sit's data disagrees with its own schema,
          // guessing which one is dev's counterpart would be worse than
          // leaving it for a human.
          result.ambiguous.push({
            devId: doc.id,
            docType: doc.type,
            lang: doc.lang,
            matchCount: matches.length,
          });
          log("warn", "reconcile.ambiguous", {
            devId: doc.id,
            docType: doc.type,
            lang: doc.lang,
            matchCount: matches.length,
          });
          continue;
        }

        const sitDoc = matches[0];
        log("info", dryRun ? "reconcile.would_link" : "reconcile.linked", {
          devId: doc.id,
          sitId: sitDoc.id,
          docType: doc.type,
        });

        if (dryRun) continue;

        mapping[doc.id] = {
          sit_id: sitDoc.id,
          doc_type: doc.type,
          uid: doc.uid || undefined,
          lang: doc.lang,
          dev_hash: canonicalHash(doc.data),
          sit_hash: canonicalHash(sitDoc.data),
          last_synced_at: new Date().toISOString(),
          last_synced_direction: "dev->sit",
          // Not "synced": dev's content was never written to this
          // document, so dev and sit are almost certainly different
          // right now. "conflict" surfaces that for review rather than
          // either silently overwriting sit's existing content or
          // leaving this document stuck failing the same collision on
          // every migrate.
          status: "conflict",
        };
        result.reconciled += 1;
      } catch (err) {
        // Recorded, not thrown — a real run hit exactly this: one bad
        // query (a syntax bug, since fixed) aborted the whole mutate()
        // callback, silently discarding every successful reconciliation
        // already made earlier in the same run, for documents that had
        // nothing wrong with them. See the ReconcileResult.failed comment.
        const message = err instanceof Error ? err.message : String(err);
        const failure: ReconcileResult["failed"][number] = { devId: doc.id, docType: doc.type, message };
        if (err instanceof PrismicApiError) {
          failure.status = err.status;
          failure.body = err.body;
        }
        result.failed.push(failure);
        log("error", "reconcile.failed", {
          devId: doc.id,
          docType: doc.type,
          lang: doc.lang,
          message,
          status: failure.status,
          body: failure.body,
        });
      }
    }
    return mapping;
  });

  log("info", "reconcile.done", {
    dryRun,
    reconciled: result.reconciled,
    ambiguous: result.ambiguous.length,
    notFound: result.notFound.length,
    failed: result.failed.length,
  });
  return result;
}
