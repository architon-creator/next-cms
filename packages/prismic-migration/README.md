# prismic-migration

A portable toolkit for promoting Prismic content up a **linear environment
chain** (`dev → sit → uat → prod`, one adjacent hop at a time), with
hash-gated back-sync down to the adjacent lower tier — implementing the
plan reviewed alongside this code (see the plan review this was built from
for the full design rationale and the gaps called out below).

**Environment-chain model.** Every pairwise command (`preflight`/`assets`/
`migrate`/`reconcile`/`link`/`unlink`/`retitle`/`confirm`/`verify`/
`backsync`) takes mandatory `--from=<env>` and `--to=<env>` flags, naming
two **adjacent** entries in your configured `ENVIRONMENT_CHAIN` (default
`dev,sit,uat,prod`). Which environment is "lower" (closer to authoring)
and which is "upper" (closer to production) is derived from chain order,
not from `--from`/`--to` order — `--from=dev --to=sit` and `--from=sit
--to=dev` both resolve to the same dev/sit mapping file, but a
forward-only command (`preflight`/`assets`/`migrate`/`reconcile`/
`retitle`/`confirm`) requires `--from` to be the lower one, and `backsync`
requires `--from` to be the upper one — get the direction backwards and
the command refuses to run, naming the correct command to use instead. One
mapping file per adjacent pair (`dev-sit-mapping.json`,
`sit-uat-mapping.json`, ...) serves both directions for that pair. Only
one hop at a time is supported — `--from=dev --to=uat` (skipping sit) is
rejected as non-adjacent; a skip-tier hotfix path is a possible future
extension, not built yet.

**Battle-tested, not just written:** this toolkit's original two-environment
design (dev/sit only, no `--from`/`--to`) was run end-to-end against a real
dev/sit Prismic migration — 26 documents, 49 assets, several
non-repeatable-type collisions, multi-locale documents, plain Image fields,
and Content Relationship fields — finishing with `verify` reporting
`passed: true` (document count match, zero spot-check mismatches, zero
broken links, zero orphaned assets). The environment-chain refactor
described above generalized that same, real-run-tested logic to work
between any adjacent pair, and every phase's own logic is unchanged except
for reading `pair.lower`/`pair.upper` instead of a hardcoded `config.dev`/
`config.sit` — see "Known gaps" and "Prismic API specifics confirmed the
hard way" for what's proven and what's still genuinely unverified. If you
have an existing mapping store from before this refactor, see "Upgrading
from a pre-chain mapping store" below.

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

Every command below is pairwise: it takes mandatory `--from=<env> --to=<env>`
(see "Environment-chain model" above for what that resolves to).

| Command                       | Direction | Plan phase | What it does                                                                                                                                                                                                                                                               |
| ----------------------------- | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight`                   | forward   | Phase 0    | Diffs lower vs. upper custom types, pushes missing/differing ones to upper, snapshots both environments, initializes the pair's mapping files                                                                                                                              |
| `assets`                      | forward   | Phase 1    | Migrates the lower environment's asset library up, idempotent on re-run                                                                                                                                                                                                    |
| `migrate`                     | forward   | Phase 2    | Two-pass document migration lower to upper (assets first, then document links once every doc has an upper id). Processes every document it can even if some fail — see "Known gaps."                                                                                       |
| `promote`                     | forward   | —          | Convenience wrapper for ONE hop of `preflight`+`assets`+`migrate` toward `--to`, which may be several hops away. Prints the exact next command to run once you've published that hop's Migration Release. See below.                                                       |
| `reconcile`                   | forward   | —          | Links a lower document to a pre-existing upper document of the same non-repeatable type + locale, when `migrate` fails with "already exist ... non-repeatable" (see below)                                                                                                 |
| `link <lowerId> <upperId>`    | —         | —          | Manual fallback when `reconcile` reports a type as `notFound` — the pre-existing upper document is an unpublished draft, invisible to the content API. You supply the upper id (from its dashboard URL).                                                                   |
| `unlink <lowerId>`            | —         | —          | Undoes a `link`/`reconcile` — forgets the mapping entry, doesn't touch the upper environment. Use when the linked upper document should be discarded instead of kept: delete it in the dashboard, `unlink` here, then `migrate` again for a fresh copy.                    |
| `inspect <lowerId> [upperId]` | —         | —          | Pretty-prints the lower document's raw `data` JSON — for checking a field's actual shape against what `rewriteRefs` assumes, rather than guessing. Pass an upperId too to print the upper environment's live version alongside it, for diffing a `verify` mismatch by eye. |
| `retitle`                     | forward   | —          | One-time bulk fix for documents created with the raw lower-environment id as their title (see below) — only touches the upper document when the lower document is unchanged since the original migration                                                                   |
| `confirm`                     | forward   | Phase 2    | Marks documents `synced` once they're actually live at the upper environment's master ref (closes the "how do we know the Release was published" gap — see below)                                                                                                          |
| `verify`                      | either    | Phase 3    | Read-only: document count match, spot-check re-hash, broken-link scan, asset check. Exits non-zero on any failure.                                                                                                                                                         |
| `backsync`                    | backward  | Phase 4    | Ongoing upper to lower sync, gated by the full 4-quadrant conflict matrix (see below). Exits non-zero if any conflict is found.                                                                                                                                            |

Every write command also accepts `--dry-run` and only logs the planned
diff. Run these from inside this package's own directory
(`cd packages/prismic-migration`) — or from the repo root via
`pnpm --filter prismic-migration run cli <command>`, which pnpm runs with
this directory as the working directory anyway:

```bash
pnpm cli preflight --from=dev --to=sit
pnpm cli assets --from=dev --to=sit     # NOT --dry-run — dry-run writes nothing, including
                                         # the asset mapping file, and migrate needs that
                                         # populated or every image/media reference fails
                                         # "Assets not found"
pnpm cli migrate --from=dev --to=sit
pnpm cli reconcile --from=dev --to=sit  # only if migrate reported "already exist ... non-repeatable"
pnpm cli migrate --from=dev --to=sit    # re-run — reconciled documents are now skipped, not retried
pnpm cli confirm --from=dev --to=sit    # after a human publishes the Migration Release in sit
pnpm cli verify --from=dev --to=sit
pnpm cli backsync --from=sit --to=dev   # note: --from is the UPPER env for backsync

# Once sit is promoted, repeat the same sequence one hop further up the chain:
pnpm cli preflight --from=sit --to=uat
pnpm cli migrate --from=sit --to=uat
# ...and so on to uat to prod.
```

(`pnpm cli <command>` runs the TypeScript source directly via `tsx`, for
local use. `pnpm build && node dist/cli.js <command>` runs the compiled
output, for CI. Data paths — `.env`, `./data`, `./snapshots`, `./.cache`,
`./reports` — are all relative to the working directory the command runs
from, which is the reason to run it from inside this directory rather
than the repo root.)

### `promote` — one command instead of three, per hop

`promote` collapses `preflight` + `assets` + `migrate` into a single call
for one hop, and tells you exactly what to run next — including toward a
destination several hops away:

```bash
pnpm cli promote --from=dev --to=prod
```

`--to=prod` here does NOT mean this one command reaches prod. It can't:
`migrate` only ever reads a lower environment's **published** content
(the master ref), so the next hop can't safely run until a human publishes
the Migration Release this hop just created — running every hop
unattended would mean either skipping unpublished content or silently
auto-publishing, and this toolkit never auto-publishes (see "Design
decisions" below). Instead, `promote` runs the first hop only (`dev` ->
`sit`) and prints something like:

```
Hop dev -> sit complete.
Next: publish the Migration Release in sit's dashboard, then run:
  pnpm cli confirm --from=dev --to=sit
Then continue up the chain with:
  pnpm cli promote --from=sit --to=prod
```

Publish, run `confirm`, then run the printed `promote` command again to do
the next hop — repeating until the final hop reports there's nothing more
to promote. `--dry-run` works the same as any other write command (logs
the planned diff for that one hop, writes nothing).

## Setup

Inside this repo, a root-level `pnpm install` already covers this package —
no separate install step needed here. Standalone (after copying this
folder elsewhere):

```bash
cp .env.example .env   # fill in the environments you actually use — see .env.example
pnpm install
pnpm test               # 68 tests, all pure logic — no live Prismic credentials needed
```

`.env.example` documents `ENVIRONMENT_CHAIN` (default `dev,sit,uat,prod`)
and, for each name in it, `<NAME>_REPOSITORY` / `<NAME>_ACCESS_TOKEN` /
`<NAME>_MIGRATION_TOKEN`. You only need to configure the environments
you're actually promoting between right now — an environment left
unconfigured is simply skipped by `loadConfig()`, and only becomes an
error if a command's `--from`/`--to` actually references it.

`<NAME>_MIGRATION_TOKEN` (e.g. `DEV_MIGRATION_TOKEN`, `SIT_MIGRATION_TOKEN`)
is a write-scoped permanent token (`npx prismic token create --write`) —
materially higher privilege than a normal read-only access token. Keep it
out of logs and out of the mapping files; nothing in this codebase writes
it anywhere but the `Authorization` header.

## Design decisions worth knowing before you rely on this

**Canonical hashing.** Every hash in this toolkit goes through
[`lib/canonical-hash.ts`](src/lib/canonical-hash.ts), which deep-sorts
object keys before hashing. Two structurally identical payloads hash the
same regardless of what order Prismic's API happened to return their keys
in — without this, every hash-based rule here would be unreliable.

**One mapping file per adjacent pair, keyed by `lower`/`upper` roles, not
`source`/`target`.** `source`/`target` would flip meaning depending on
whether a `migrate` (forward, lower → upper) or `backsync` (backward,
upper → lower) last touched a pair's mapping file — `lower`/`upper` are
fixed properties of the pair itself, so `dev-sit-mapping.json` serves both
`migrate --from=dev --to=sit` and `backsync --from=sit --to=dev` without
either direction reinterpreting the other's fields. See
[`src/lib/environments.ts`](src/lib/environments.ts) (`resolvePair`,
`requireDirection`) and [`src/lib/mapping-paths.ts`](src/lib/mapping-paths.ts)
for how a pair resolves to its mapping file names.

**The mapping schema maps 1:1 onto a future DynamoDB item** —
`PK: lower_id` (the map key), `SK: upper_id`, every other field an
attribute, with a GSI on `upper_id` and one on `status`. A `pair` attribute
(e.g. `"dev-sit"`) would distinguish rows across different adjacent pairs
sharing one table. See [`src/types.ts`](src/types.ts). Swapping
[`lib/mapping-store.ts`](src/lib/mapping-store.ts)'s file I/O for
`PutItem`/`GetItem` calls is the only change needed when that migration
happens — nothing else in the codebase touches the mapping file directly.

**Concurrency:** the lockfile in
[`lib/lock.ts`](src/lib/lock.ts) stops two runs on the _same host_ from
touching the same pair's mapping file at once. It is **not** a substitute
for a CI `concurrency:` group — a committed lockfile can't safely
arbitrate between two fresh checkouts racing each other. Set a
`concurrency:` group (scoped per pair, e.g. keyed on `--from`/`--to`) on
whatever workflow invokes this tool.

**The 4-quadrant back-sync matrix** (`classifySync` in
[`phases/phase4-backsync.ts`](src/phases/phase4-backsync.ts)) makes explicit
what the original plan only stated two rows of:

|                 | upper unchanged                                                     | upper changed              |
| --------------- | ------------------------------------------------------------------- | -------------------------- |
| lower unchanged | no-op                                                               | fast-forward upper → lower |
| lower changed   | **pending** (a normal forward-sync candidate — run `migrate` again) | **conflict**               |

Only "both sides changed independently" is a real conflict. "Lower changed,
upper didn't" is not treated as a conflict — `migrate` already skips docs
whose hash hasn't changed and re-syncs the ones that have, so this
resolves on the next forward-sync run rather than needing a human.

**Publish confirmation** has no dedicated Prismic Release-status API to
poll, so `confirm` asks the question the pipeline actually needs answered:
"is this upper document now live at the upper environment's master ref?" —
for every mapping entry still `status: "pending"`. Run it after a human
publishes the Migration Release in the upper environment's dashboard.

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

- **Only one hop at a time — no skip-tier path yet.** `--from=dev --to=uat`
  is rejected as non-adjacent even though both are in the chain; promoting
  through an intermediate tier without actually running `migrate` against
  it (an emergency hotfix path) is a deliberate future extension, not
  built. For now, promote through every intermediate environment in order.
- **`retitle` recomputes and re-PUTs the lower document's data, not just
  the title** — the safest way this codebase has to correct a title
  without guessing at a currently-unpublished draft's content (drafts
  aren't visible via the master-ref-only content API). It only writes when
  the recomputed hash still matches `lower_hash`, so the write is a no-op
  on `data` in practice — but this is still a real write to a real
  document. Run it with `--dry-run` first, and expect it to skip (not
  force) any document where the lower environment has moved on since the
  original migration.
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
  lower → upper. If an editor uploads a new asset directly in the upper
  environment and it later needs to flow back down via `backsync`,
  there's no lower-ward asset mapping for `rewriteRefs` to use yet — see
  the note in [`phases/phase4-backsync.ts`](src/phases/phase4-backsync.ts).
- **Rollback is not implemented.** `preflight`'s snapshots are a restore
  point in the sense of "evidence to diff against and replay from by
  hand" — there is no `restore` command that takes a snapshot and
  actually undoes a bad publish. Build that runbook once the happy path is
  validated against real repositories.
- **Document/asset deletions are out of scope.** `verify` and `backsync`
  both silently skip a mapping entry whose lower or upper document has
  been deleted, rather than flagging it.
- **`reconcile` only handles non-repeatable types.** If the upper
  environment already has pre-existing content for a _repeatable_ custom
  type (many possible documents), there's no automated way to guess which
  upper document corresponds to which lower document — that still needs a
  human decision, by hand, in the pair's mapping file.
- **`reconcile` marks a link as `status: "conflict"`, not `"synced"`,
  and never overwrites the upper environment's existing content** — it
  only stops `migrate` from trying to create a duplicate. Whether the
  lower document's content actually matches what's already in the upper
  environment is left for a human to check (or for `backsync`'s hash
  comparison to catch later); reconciling the link doesn't mean the
  content is reconciled.
- **`reconcile` can't find a pre-existing upper document that's still an
  unpublished draft** — confirmed on a real run: the content API only
  sees the master ref (published content), so a type/locale that
  `migrate` proves already exists in the upper environment can still come
  back with zero matches from `reconcile`. Reported as `notFound`
  (distinct from `ambiguous`) — resolve those with
  `link --from=<lower> --to=<upper> <lowerId> <upperId>`, supplying the
  upper id yourself from the dashboard. `link` itself degrades to an
  empty `upper_hash` if even a known id is unreadable (still a draft);
  safe, since a `"conflict"` entry's `upper_hash` isn't compared by
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

## Upgrading from a pre-chain mapping store

If you ran this toolkit before the environment-chain refactor (dev/sit
hardcoded, no `--from`/`--to`), your existing `data/mapping.json` and
`data/asset-mapping.json` use the old field names (`sit_id`, `dev_hash`,
`sit_hash`, `sit_asset_id`, `sit_url`) and aren't in a pair-scoped file.
Convert them once:

```bash
pnpm migrate-legacy-mapping
```

This reads the old files, renames every field to the new `lower_`/`upper_`
scheme, and writes `data/dev-sit-mapping.json` /
`data/dev-sit-asset-mapping.json` — the same shape every other pair now
uses. It refuses to run if those new-format files already exist (never
overwrites a mapping this toolkit's own commands may have since written),
and never deletes the old files itself. After running it:

```bash
pnpm cli verify --from=dev --to=sit   # confirm the converted mapping still checks out
```

Then delete `data/mapping.json` and `data/asset-mapping.json` by hand once
you're satisfied.

## Viewing a run's logs

Every command logs one JSON object per line (`{ ts, level, event, ...fields }`
— see [`lib/logger.ts`](src/lib/logger.ts)) to stdout. To browse a run
afterward instead of scrolling raw terminal output, capture it to a file
and open [`tools/log-viewer.html`](tools/log-viewer.html) directly in a
browser (double-click it — no server or build step needed):

```bash
pnpm cli migrate --from=dev --to=sit > run.log 2>&1
# then open tools/log-viewer.html and choose run.log
```

It's a single self-contained HTML file — filters by level (info/warn/
error) and free-text search across event names and field values, click a
row to expand its full JSON. Everything happens in your browser; the log
never leaves your machine. A non-JSON line (e.g. `pnpm`'s own `$ tsx ...`
banner, or an `[ELIFECYCLE]` failure line if a command exited non-zero) is
shown as-is rather than dropped or crashing the page.

## Testing

```bash
pnpm test
```

68 tests across canonical hashing, the mapping store (including lock
contention), the link/asset rewriter (both real field shapes, and the
denormalization-stripping comparator), the custom-type diff, the
4-quadrant conflict matrix, the rate limiter, retry/backoff behavior, a
full `runPhase2` run against a mocked fetch, the Migration/Asset API
request shapes, environment-chain resolution (`resolvePair`/`resolveNextHop`/
`requireDirection` — adjacency, direction enforcement, not-configured
handling), pair-scoped mapping file naming, and the legacy-mapping
conversion script — all pure logic or mocked `fetch`, no live call, so no
credentials are needed to run them.

That's deliberately the fast, no-credentials layer — it is not a
substitute for a real run. This toolkit's original two-environment logic
HAS been run end-to-end against a real dev/sit Prismic migration (see the
top of this README); the environment-chain refactor generalized that same
logic to arbitrary adjacent pairs without changing what each phase
actually does, but the refactor itself has only been smoke-tested against
the CLI's argument parsing and direction-enforcement paths, not against a
second real pair (e.g. sit → uat) end-to-end. If you're adapting this for
a different project, run it against disposable repositories first for
whichever pair you promote between, the same way dev/sit was here.
