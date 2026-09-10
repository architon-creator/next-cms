# prismic-migration — folder structure

```
prismic-migration/
├── README.md                        Overview, setup, design decisions, known gaps to verify
├── STRUCTURE.md                     This file
├── package.json                     Standalone package — its own deps, no workspace dependency
├── pnpm-lock.yaml                   Lockfile for the deps above (npm/yarn work too, just relock)
├── tsconfig.json                    NodeNext ESM, strict
├── vitest.config.ts                 Points vitest at test/**/*.test.ts
├── .npmrc                           only-built-dependencies=esbuild (lets pnpm run esbuild's postinstall)
├── .env.example                     Copy to .env — DEV_*/SIT_* repo + token config
├── .gitignore                       Ignores node_modules, dist, snapshots/, reports/, .cache/, .env
│
├── data/                            The mapping store (JSON, POC-phase — see README "mapping schema")
│   ├── mapping.json                 devId -> { sit_id, hashes, status, ... } — starts as {}
│   └── asset-mapping.json           devAssetId -> { sit_asset_id, ... } — starts as {}
│
├── snapshots/                       Phase 0 restore-point exports land here (gitignored, created on run)
├── reports/                         Phase 4 conflict reports land here (gitignored, created on run)
├── .cache/                          Phase 2's inter-pass doc cache (gitignored, created on run)
│
├── src/
│   ├── cli.ts                       Entry point — argv parsing, dispatches to the phase functions below
│   ├── config.ts                    Loads/validates DEV_*/SIT_* env vars into a typed Config
│   ├── types.ts                     MappingEntry, AssetMappingEntry, PrismicDocument/Asset/CustomType
│   │
│   ├── lib/
│   │   ├── canonical-hash.ts         Deep-sorted-key JSON hash — the one hash function used everywhere
│   │   ├── mapping-store.ts          Atomic, lock-guarded read/mutate for data/*.json
│   │   ├── lock.ts                   Exclusive lockfile (same-host guard; see README on CI concurrency)
│   │   ├── rate-limit.ts             Spaces calls apart — enforces the Migration API's 1 req/sec limit
│   │   ├── logger.ts                 One structured JSON line per log event, to stdout
│   │   ├── rewrite-refs.ts           Walks document data, rewrites Media/Document link ids via an id map
│   │   ├── prismic-http.ts           Fetch wrappers: Custom Types API, Asset API, Migration API, Content API v2
│   │   └── snapshot.ts               Full document+asset export to a timestamped JSON file (Phase 0)
│   │
│   └── phases/
│       ├── phase0-preflight.ts       Custom type diff/push, snapshots, mapping init
│       ├── phase1-assets.ts          Asset migration dev -> sit, idempotent on re-run
│       ├── phase2-migrate.ts         Two-pass document migration dev -> sit
│       ├── phase2-confirm.ts         Marks pending docs "synced" once live at sit's master ref
│       ├── phase3-verify.ts          Read-only count/spot-check/broken-link/asset verification
│       └── phase4-backsync.ts        Ongoing sit -> dev sync, gated by the 4-quadrant conflict matrix
│
└── test/
    ├── canonical-hash.test.ts        Key-order independence of the hash function
    ├── mapping-store.test.ts         Load/mutate/atomic-write/lock-contention behavior
    ├── rewrite-refs.test.ts          Link/asset id rewriting, including nested slice zones
    ├── conflict-matrix.test.ts       All 4 quadrants of classifySync (phase4)
    ├── diff-custom-types.test.ts     Custom type missing/differing/identical detection (phase0)
    ├── rate-limit.test.ts            Timing behavior of the rate limiter
    └── prismic-http.test.ts          Request shape (headers/method/body) via mocked fetch
```

## To copy this into another project

1. Copy the whole `prismic-migration/` directory as-is (e.g. to `packages/prismic-migration` in a
   Turborepo/pnpm workspace, or anywhere standalone).
2. `cd prismic-migration && pnpm install` (or `npm install` — nothing here is pnpm-specific except
   the lockfile itself; delete `pnpm-lock.yaml` first if the target uses npm/yarn).
3. `cp .env.example .env` and fill in `DEV_REPOSITORY`/`DEV_MIGRATION_TOKEN`/`SIT_REPOSITORY`/
   `SIT_MIGRATION_TOKEN` (and the optional `*_ACCESS_TOKEN`s if either repo is private).
4. `pnpm test` — 31 tests, no live Prismic credentials needed, confirms the copy is intact.
5. Read README.md's "Known gaps" section before a real run against live dev/sit repositories.
