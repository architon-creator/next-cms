# prismic-migration

A portable POC toolkit for migrating Prismic content **dev → sit**, with
hash-gated **sit → dev** back-sync — implementing the plan reviewed
alongside this code (see the plan review this was built from for the full
design rationale and the gaps called out below).

**This directory is self-contained by design.** It has no dependency on
whatever monorepo it currently sits in — copy the whole
`prismic-migration/` folder into the target project (e.g. as
`packages/prismic-migration` in a Turborepo/pnpm workspace) and
`pnpm install` (or `npm install`) inside it. Nothing here assumes pnpm,
Turborepo, or any particular workspace layout.

## What's implemented

| Command     | Plan phase | What it does                                                                                                                                    |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight` | Phase 0    | Diffs dev vs. sit custom types, pushes missing/differing ones to sit, snapshots both repos, initializes the mapping files                       |
| `assets`    | Phase 1    | Migrates dev's asset library to sit, idempotent on re-run                                                                                       |
| `migrate`   | Phase 2    | Two-pass document migration dev → sit (assets first, then document links once every doc has a sit id)                                           |
| `confirm`   | Phase 2    | Marks documents `synced` once they're actually live at sit's master ref (closes the "how do we know the Release was published" gap — see below) |
| `verify`    | Phase 3    | Read-only: document count match, spot-check re-hash, broken-link scan, asset check. Exits non-zero on any failure.                              |
| `backsync`  | Phase 4    | Ongoing sit → dev sync, gated by the full 4-quadrant conflict matrix (see below). Exits non-zero if any conflict is found.                      |

Every write command accepts `--dry-run` and only logs the planned diff.

```bash
pnpm cli preflight
pnpm cli assets --dry-run
pnpm cli migrate
pnpm cli confirm       # after a human publishes the Migration Release in sit
pnpm cli verify
pnpm cli backsync
```

(`pnpm cli <command>` runs the TypeScript source directly via `tsx`, for
local use. `pnpm build && node dist/cli.js <command>` runs the compiled
output, for CI.)

## Setup

```bash
cp .env.example .env   # fill in DEV_*/SIT_* — see .env.example for what each does
pnpm install
pnpm test               # 31 tests, all pure logic — no live Prismic credentials needed
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

## Known gaps — read before a real run

- **Verify the Migration API's `Authorization` header format** against the
  code sample Prismic's own dashboard generates for your repository. Their
  technical reference documents it only as "a permanent token" without a
  literal example; this code sends `Bearer <token>` for consistency with
  the Asset and Custom Types APIs (both explicitly documented as Bearer),
  but that's an assumption, not a confirmed fact — see the comment in
  [`lib/prismic-http.ts`](src/lib/prismic-http.ts).
- **The link/asset field shape** `{ link_type: "Media" | "Document", id }`
  ([`lib/rewrite-refs.ts`](src/lib/rewrite-refs.ts)) is the REST API v2
  shape as commonly documented, but has not been run against a real
  Prismic repository's actual response. Confirm it matches before trusting
  Pass 2's link fix-up or Phase 3's spot-check.
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

31 tests across canonical hashing, the mapping store (including lock
contention), the link/asset rewriter, the custom-type diff, the 4-quadrant
conflict matrix, the rate limiter, and the Migration/Asset API request
shapes (mocked `fetch`, asserting headers/method/body — not a live call).
None of this has been run against a real Prismic repository; do that as a
next step, ideally against disposable dev/sit repositories before any real
content is involved.
