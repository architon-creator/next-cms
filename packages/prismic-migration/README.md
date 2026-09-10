# prismic-migration

A portable POC toolkit for migrating Prismic content **dev → sit**, with
hash-gated **sit → dev** back-sync — implementing the plan reviewed
alongside this code (see the plan review this was built from for the full
design rationale and the gaps called out below).

**Battle-tested, not just written:** every phase (`preflight` → `assets` →
`migrate` → `reconcile`/`link` for pre-existing content → `retitle` →
`confirm` → `verify`) has been run end-to-end against a real dev/sit
Prismic migration — 26 documents, 49 assets, several non-repeatable-type
collisions, multi-locale documents, plain Image fields, and Content
Relationship fields — finishing with `verify` reporting `passed: true`
(document count match, zero spot-check mismatches, zero broken links, zero
orphaned assets). Several assumptions below turned out wrong on that run
and are now fixed and confirmed rather than merely assumed; see "Known
gaps" and "Prismic API specifics confirmed the hard way" for exactly which
ones, and what's still genuinely unverified.

**This code is self-contained by design**, even though it now lives as a
workspace member here (`packages/prismic-migration`, part of this repo's
own `pnpm-workspace.yaml`) rather than standalone. It has no dependency on
`next-cms` itself — no imports from `cms`/`ui`, no `workspace:*` deps — so
lifting the folder back out into any other project (e.g. `packages/`
in a Turborepo/pnpm workspace, or fully standalone) is still just: copy the
directory, drop the root-level `pnpm-lock.yaml` reference to it, and
`pnpm install` (or `npm install`) inside its own folder. Nothing here
assumes pnpm, Turborepo, or any particular workspace layout.

## What's implemented

| Command                   | Plan phase | What it does                                                                                                                                                                                                                                                 |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `preflight`               | Phase 0    | Diffs dev vs. sit custom types, pushes missing/differing ones to sit, snapshots both repos, initializes the mapping files                                                                                                                                    |
| `assets`                  | Phase 1    | Migrates dev's asset library to sit, idempotent on re-run                                                                                                                                                                                                    |
| `migrate`                 | Phase 2    | Two-pass document migration dev → sit (assets first, then document links once every doc has a sit id). Processes every document it can even if some fail — see "Known gaps."                                                                                 |
| `reconcile`               | —          | Links a dev document to a pre-existing sit document of the same non-repeatable type + locale, when `migrate` fails with "already exist ... non-repeatable" (see below)                                                                                       |
| `link <devId> <sitId>`    | —          | Manual fallback when `reconcile` reports a type as `notFound` — the pre-existing sit document is an unpublished draft, invisible to the content API. You supply the sit id (from its dashboard URL).                                                         |
| `unlink <devId>`          | —          | Undoes a `link`/`reconcile` — forgets the mapping entry, doesn't touch sit. Use when the linked sit document should be discarded instead of kept: delete it in the dashboard, `unlink` here, then `migrate` again for a fresh copy.                          |
| `inspect <devId> [sitId]` | —          | Pretty-prints a dev document's raw `data` JSON — for checking a field's actual shape against what `rewriteRefs` assumes, rather than guessing. Pass a sitId too to print sit's live version alongside it, for diffing a `verify` spot-check mismatch by eye. |
| `retitle`                 | —          | One-time bulk fix for documents created with the raw dev id as their title (see below) — only touches sit when dev is unchanged since the original migration                                                                                                 |
| `confirm`                 | Phase 2    | Marks documents `synced` once they're actually live at sit's master ref (closes the "how do we know the Release was published" gap — see below)                                                                                                              |
| `verify`                  | Phase 3    | Read-only: document count match, spot-check re-hash, broken-link scan, asset check. Exits non-zero on any failure.                                                                                                                                           |
| `backsync`                | Phase 4    | Ongoing sit → dev sync, gated by the full 4-quadrant conflict matrix (see below). Exits non-zero if any conflict is found.                                                                                                                                   |

Every write command accepts `--dry-run` and only logs the planned diff.
Run these from inside this package's own directory
(`cd packages/prismic-migration`) — or from the repo root via
`pnpm --filter prismic-migration run cli <command>`, which pnpm runs with
this directory as the working directory anyway:

```bash
pnpm cli preflight
pnpm cli assets            # NOT --dry-run — dry-run writes nothing, including
                            # asset-mapping.json, and migrate needs that populated
                            # or every image/media reference fails "Assets not found"
pnpm cli migrate
pnpm cli reconcile         # only if migrate reported "already exist ... non-repeatable"
pnpm cli migrate           # re-run — reconciled documents are now skipped, not retried
pnpm cli confirm           # after a human publishes the Migration Release in sit
pnpm cli verify
pnpm cli backsync
```

(`pnpm cli <command>` runs the TypeScript source directly via `tsx`, for
local use. `pnpm build && node dist/cli.js <command>` runs the compiled
output, for CI. Data paths — `.env`, `./data`, `./snapshots`, `./.cache`,
`./reports` — are all relative to the working directory the command runs
from, which is the reason to run it from inside this directory rather
than the repo root.)

## Setup

Inside this repo, a root-level `pnpm install` already covers this package —
no separate install step needed here. Standalone (after copying this
folder elsewhere):

```bash
cp .env.example .env   # fill in DEV_*/SIT_* — see .env.example for what each does
pnpm install
pnpm test               # 43 tests, all pure logic — no live Prismic credentials needed
```

`DEV_MIGRATION_TOKEN`/`SIT_MIGRATION_TOKEN` are write-scoped permanent
tokens (`npx prismic token create --write`) — materially higher privilege
than a normal read-only access token. Keep them out of logs and out of the
mapping files; nothing in this codebase writes them anywhere but the
`Authorization` header.

## Design decisions worth knowing before you rely on this

**Canonical hashing.** Every hash in this toolkit goes through
[`lib/canonical-hash.ts`](src/lib/canonical-hash.ts), which deep-sorts
object keys before hashing. Two structurally identical payloads hash the
same regardless of what order Prismic's API happened to return their keys
in — without this, every hash-based rule here would be unreliable.

**The mapping schema maps 1:1 onto a future DynamoDB item** —
`PK: dev_id`, `SK: sit_id`, every other field an attribute, with a GSI on
`sit_id` and one on `status`. See [`src/types.ts`](src/types.ts). Swapping
[`lib/mapping-store.ts`](src/lib/mapping-store.ts)'s file I/O for
`PutItem`/`GetItem` calls is the only change needed when that migration
happens — nothing else in the codebase touches the mapping file directly.

**Concurrency:** the lockfile in
[`lib/lock.ts`](src/lib/lock.ts) stops two runs on the _same host_ from
touching the mapping file at once. It is **not** a substitute for a CI
`concurrency:` group — a committed lockfile can't safely arbitrate between
two fresh checkouts racing each other. Set a `concurrency:` group on
whatever workflow invokes this tool.

**The 4-quadrant back-sync matrix** (`classifySync` in
[`phases/phase4-backsync.ts`](src/phases/phase4-backsync.ts)) makes explicit
what the original plan only stated two rows of:

|               | sit unchanged                                                       | sit changed          |
| ------------- | ------------------------------------------------------------------- | -------------------- |
| dev unchanged | no-op                                                               | fast-forward sit→dev |
| dev changed   | **pending** (a normal forward-sync candidate — run `migrate` again) | **conflict**         |

Only "both sides changed independently" is a real conflict. "Dev changed,
sit didn't" is not treated as a conflict — `migrate` already skips docs
whose hash hasn't changed and re-syncs the ones that have, so this
resolves on the next forward-sync run rather than needing a human.

**Publish confirmation** has no dedicated Prismic Release-status API to
poll, so `confirm` asks the question the pipeline actually needs answered:
"is this sit document now live at sit's master ref?" — for every mapping
entry still `status: "pending"`. Run it after a human publishes the
Migration Release in the sit dashboard.

**Retry on 429 and transient gateway errors.** Confirmed against a real
run: Prismic's rate limits aren't limited to the Migration API's
documented "1 req/sec" — the Asset API's list endpoint rejected a plain
paginated GET loop with 429 on its own. Every request in
[`lib/prismic-http.ts`](src/lib/prismic-http.ts) now retries on
429/502/503/504 (honoring a `Retry-After` header when present, otherwise
exponential backoff with jitter, capped at 5 attempts), and logs each
retry as a `prismic_http.retrying` event so a slow run is visible rather
than looking hung.

## Prismic API specifics confirmed the hard way

Things a real run got wrong on the first (or second) try, now fixed and
confirmed — kept here so nobody has to rediscover them by trial and error
if this code is extended:

- **The Migration API's `Authorization` header is `Bearer <token>`.**
  Prismic's own technical reference never states this explicitly (it just
  says "a permanent token"), but dozens of real `createMigrationDocument`/
  `updateMigrationDocument` calls across this session all succeeded with
  this format — confirmed, not merely assumed.
- **Combining predicates in a `q` query is `[[pred1][pred2]]`** — each
  predicate gets its own `[...]` wrapper, concatenated with **no
  separator** between them, the whole thing in one outer `[...]`. Two
  wrong guesses preceded this: `[[pred1],[pred2]]` (a comma between the
  bracket groups) and `[[pred1,pred2]]` (both predicates crammed into one
  bracket) each produced a distinct, real `api_parsing_error`. A single
  predicate — `[[pred1]]` — happens to look identical under all three
  (wrong and right) schemes, which is why `getDocumentById`'s queries
  never surfaced this and only a two-predicate query in `reconcile` did.
- **Locale is a query PARAMETER (`lang=<code>` or `lang=*`), never a
  predicate.** `at(document.lang, "en-us")` looks like a reasonable
  predicate to write and fails immediately with `[function at(..)]
unexpected field 'document.lang'` — locale filtering happens entirely
  through the `lang` param already used elsewhere in this file for "every
  locale" (`*`).
- **Two Prismic-specific field shapes needed real responses to get right**
  — a plain Image field (`{ dimensions, alt, copyright, url, id, edit }`,
  no `link_type` at all) versus a "Link to Media" field (`{ link_type:
"Media", id }`), and a Content Relationship field's read-time
  denormalization of the target document's own metadata. See "Known gaps"
  below for the full detail on both — they're significant enough to also
  live there, not just here.

## Known gaps — read before a real run

- **`retitle` recomputes and re-PUTs dev's data, not just the title** —
  the safest way this codebase has to correct a title without guessing at
  a currently-unpublished draft's content (drafts aren't visible via the
  master-ref-only content API). It only writes when the recomputed hash
  still matches `dev_hash`, so the write is a no-op on `data` in practice
  — but this is still a real write to a real document. Run it with
  `--dry-run` first, and expect it to skip (not force) any document where
  dev has moved on since the original migration.
- **`preflight` only syncs the Custom Types API (`/customtypes`) — not a
  separate Shared Slices library.** If your project manages slices inline
  within each custom type's own JSON (the dashboard Type Builder's default
  pattern), a slice change IS covered — it's just part of that type's JSON
  diff. If instead your slices live in Prismic's separate Shared Slices
  library (the Slice Machine workflow — slices independently versioned and
  referenced by id from a type, not embedded in its JSON), `preflight` has
  no code path to sync that library at all; adding one would need the
  Shared Slices API, not yet built here. Confirm which pattern your project
  uses with `pnpm cli preflight --dry-run` after a real slice change in
  dev: if the affected type shows up under `differing`, you're covered; if
  not, that's the gap.
- **The Document-link field shape** `{ link_type: "Document", id }` was
  confirmed on a real run, and turned out to have a wrinkle: Prismic
  denormalizes a live snapshot of the target document's own state onto
  the field at read time — `type`, `tags`, `lang`, `slug`,
  `first_publication_date`, `last_publication_date`, `isBroken`. None of
  that is written or controlled by this toolkit; `rewriteRefs` only ever
  touches `id`, which is correct — but it means a raw hash comparison of
  the full field will "mismatch" between dev and sit even on a perfectly
  correct migration, since each side denormalizes from its own target
  document's current state. Phase 3's spot-check now runs both sides
  through `normalizeForComparison()` first, which strips a Document/Media
  link down to `{ link_type, id }` and an Image field down to `{ id }`
  before hashing — the broken-link scan and asset check are what actually
  verify `id` resolves to something real, so the spot-check no longer
  needs to (and shouldn't) treat denormalized metadata as authoritative.
  <br><br>
  The asset field shape assumption WAS wrong too, confirmed on the same
  run: a document kept failing "Assets not found" despite its images
  being fully migrated, because Prismic's plain Image fields (`{
dimensions, alt, copyright, url, id, edit }`, no `link_type` at all)
  are more common in practice than "Link to Media" fields (`{ link_type:
"Media", id }`, the only shape originally assumed here). Both are now
  handled — Image fields get both `id` and `url` rewritten, since `id`
  alone would leave the document hot-linking to dev's CDN forever.
- **Asset back-sync isn't implemented.** Phase 1 only migrates assets
  dev → sit. If an editor uploads a new asset directly in sit and it later
  needs to flow back to dev via `backsync`, there's no dev-ward asset
  mapping for `rewriteRefs` to use yet — see the note in
  [`phases/phase4-backsync.ts`](src/phases/phase4-backsync.ts).
- **Rollback is not implemented.** `preflight`'s snapshots are a restore
  point in the sense of "evidence to diff against and replay from by
  hand" — there is no `restore` command that takes a snapshot and
  actually undoes a bad publish. Build that runbook once the happy path is
  validated against real repositories.
- **Document/asset deletions are out of scope.** `verify` and `backsync`
  both silently skip a mapping entry whose dev or sit document has been
  deleted, rather than flagging it.
- **`reconcile` only handles non-repeatable types.** If sit already has
  pre-existing content for a _repeatable_ custom type (many possible
  documents), there's no automated way to guess which sit document
  corresponds to which dev document — that still needs a human decision,
  by hand, in `data/mapping.json`.
- **`reconcile` marks a link as `status: "conflict"`, not `"synced"`,
  and never overwrites sit's existing content** — it only stops `migrate`
  from trying to create a duplicate. Whether dev's content actually
  matches what's already in sit is left for a human to check (or for
  `backsync`'s hash comparison to catch later); reconciling the link
  doesn't mean the content is reconciled.
- **`reconcile` can't find a pre-existing sit document that's still an
  unpublished draft** — confirmed on a real run: the content API only
  sees the master ref (published content), so a type/locale that
  `migrate` proves already exists in sit can still come back with zero
  matches from `reconcile`. Reported as `notFound` (distinct from
  `ambiguous`) — resolve those with `link <devId> <sitId>`, supplying
  the sit id yourself from the dashboard. `link` itself degrades to an
  empty `sit_hash` if even a known id is unreadable (still a draft);
  safe, since a `"conflict"` entry's `sit_hash` isn't compared by
  anything until a human resolves it.
- **No request timeout.** `lib/prismic-http.ts`'s `request()` has no
  `AbortController`/timeout, so a request against an unreachable or
  black-holing host hangs indefinitely rather than failing fast. This
  matters more than usual here because `cli.ts` deliberately uses
  `process.exitCode` rather than `process.exit()` on failure (see the
  comment there — an immediate `process.exit()` was reproduced crashing
  the Node runtime on Windows when a sibling in-flight request got yanked
  mid-socket) — that fix trades "crash on a failure" for "hang forever on
  a request that never settles." Add a timeout if that trade-off bites.

## Testing

```bash
pnpm test
```

43 tests across canonical hashing, the mapping store (including lock
contention), the link/asset rewriter (both real field shapes, and the
denormalization-stripping comparator), the custom-type diff, the
4-quadrant conflict matrix, the rate limiter, retry/backoff behavior, a
full `runPhase2` run against a mocked fetch, and the Migration/Asset API
request shapes — all pure logic or mocked `fetch`, no live call, so no
credentials are needed to run them.

That's deliberately the fast, no-credentials layer — it is not a
substitute for a real run. This toolkit HAS since been run end-to-end
against a real dev/sit Prismic migration (see the top of this README); if
you're adapting this for a different project, do the same before trusting
it with real content — ideally against disposable dev/sit repositories
first, the same way this one was.
