import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { mappingFilePath } from "../lib/mapping-paths.js";
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
  pair: ResolvedPair;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type ReconcileResult = {
  reconciled: number;
  ambiguous: { lowerId: string; docType: string; lang: string; matchCount: number }[];
  /**
   * Non-repeatable, but the content API found zero matching upper
   * documents — this happens when the pre-existing upper document is
   * itself an unpublished draft (the content API only sees the master
   * ref, never drafts), which `migrate`'s "already exist" error will
   * still confirm. Nothing automated can resolve these: find the
   * document's id in the upper environment's dashboard and add it to the
   * pair's mapping file by hand (or wire up a manual `link <lowerId>
   * <upperId>` command if this becomes a recurring need).
   */
  notFound: { lowerId: string; docType: string; lang: string }[];
  /**
   * A findDocumentsByType call itself threw (network error, an API 4xx
   * like the query-syntax bug this codebase already hit once) — recorded
   * rather than thrown, for the same reason phase2-migrate.ts's per-
   * document try/catch exists: one document's failure must not abort the
   * whole mappingStore.mutate() callback, which would otherwise silently
   * discard every successful reconciliation this run already made before
   * the failure (mutate() only persists if its callback returns normally).
   */
  failed: {
    lowerId: string;
    docType: string;
    message: string;
    status?: number;
    body?: string;
  }[];
};

/**
 * Links a lower-environment document to a pre-existing upper-environment
 * document for the same non-repeatable custom type — the gap Phase 0's
 * own text names ("seeded if any documents were manually created in the
 * upper environment already") but never built tooling for, and which a
 * real run made unavoidable: 16 of 17 `migrate` failures in one run were
 * exactly this — a real upper environment that already had content for
 * every singleton page type before this tool ever ran, none of it
 * recorded in the mapping file, so every create attempt collided with
 * Prismic's non-repeatable constraint.
 *
 * Deliberately narrow in scope: only handles non-repeatable types (where
 * "exactly one document of this type already exists" is an unambiguous
 * match — there's nothing else it could be). Does NOT attempt to
 * reconcile repeatable types by uid; a repeatable type can have many
 * pre-existing upper documents, and guessing which one corresponds to a
 * given lower document is a different, harder problem this doesn't solve.
 *
 * Deliberately does not write the lower document's content into the
 * matched upper document — rule #1 (never overwrite without a hash
 * comparison) means this only ever links lower_id -> the existing
 * upper_id, marks the entry `status: "conflict"`, and leaves reconciling
 * the actual content difference (if any) to a human, or to `backsync`'s
 * conflict handling. The upside: `migrate` stops trying to create a
 * duplicate every run.
 */
export async function runReconcile({
  config,
  pair,
  dryRun,
  fetchImpl = fetch,
}: ReconcileOptions): Promise<ReconcileResult> {
  log("info", "reconcile.start", { dryRun, from: pair.lowerName, to: pair.upperName });

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  const upperCustomTypes = await listCustomTypes(pair.upper, fetchImpl);
  const nonRepeatableTypes = new Set(
    upperCustomTypes.filter((t) => !t.repeatable).map((t) => t.id),
  );

  const result: ReconcileResult = {
    reconciled: 0,
    ambiguous: [],
    notFound: [],
    failed: [],
  };

  await mappingStore.mutate(async (mapping) => {
    for await (const doc of iterateAllDocuments(pair.lower, lowerRef, fetchImpl)) {
      if (mapping[doc.id]) continue; // already linked — nothing to reconcile
      if (!nonRepeatableTypes.has(doc.type)) continue; // out of scope, see doc comment above

      try {
        const matches = await findDocumentsByType(
          pair.upper,
          upperRef,
          doc.type,
          doc.lang,
          fetchImpl,
        );

        if (matches.length === 0) {
          // The content API (master-ref only) can't see an unpublished
          // draft — this is NOT "nothing to reconcile", it's "reconcile
          // can't see it". migrate will keep failing on this one until
          // it's linked by hand.
          result.notFound.push({ lowerId: doc.id, docType: doc.type, lang: doc.lang });
          log("warn", "reconcile.not_found", {
            lowerId: doc.id,
            docType: doc.type,
            lang: doc.lang,
          });
          continue;
        }

        if (matches.length > 1) {
          // Shouldn't be possible for a genuinely non-repeatable type per
          // locale, but if the upper environment's data disagrees with
          // its own schema, guessing which one is the lower document's
          // counterpart would be worse than leaving it for a human.
          result.ambiguous.push({
            lowerId: doc.id,
            docType: doc.type,
            lang: doc.lang,
            matchCount: matches.length,
          });
          log("warn", "reconcile.ambiguous", {
            lowerId: doc.id,
            docType: doc.type,
            lang: doc.lang,
            matchCount: matches.length,
          });
          continue;
        }

        const upperDoc = matches[0];
        log("info", dryRun ? "reconcile.would_link" : "reconcile.linked", {
          lowerId: doc.id,
          upperId: upperDoc.id,
          docType: doc.type,
        });

        if (dryRun) continue;

        mapping[doc.id] = {
          upper_id: upperDoc.id,
          doc_type: doc.type,
          uid: doc.uid || undefined,
          lang: doc.lang,
          lower_hash: canonicalHash(doc.data),
          upper_hash: canonicalHash(upperDoc.data),
          last_synced_at: new Date().toISOString(),
          last_synced_direction: "forward",
          // Not "synced": the lower document's content was never written
          // to this document, so lower and upper are almost certainly
          // different right now. "conflict" surfaces that for review
          // rather than either silently overwriting the upper
          // environment's existing content or leaving this document
          // stuck failing the same collision on every migrate.
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
        const failure: ReconcileResult["failed"][number] = {
          lowerId: doc.id,
          docType: doc.type,
          message,
        };
        if (err instanceof PrismicApiError) {
          failure.status = err.status;
          failure.body = err.body;
        }
        result.failed.push(failure);
        log("error", "reconcile.failed", {
          lowerId: doc.id,
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
