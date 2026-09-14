# OTel integration — ibe-app / top-app

Ported from `next-cms`'s own OTel work (commits `72e84e0`, `17a37a6` on its
`master`), adapted for this project's shape: two Next.js apps
(`ibe-app`, `top-app`) with no backend in this repo — the backend is owned
by another team.

## What's in this branch

- `reference-otel-*.{ts,json}` → copy into a new `packages/otel/` workspace
  package (same role as this repo's existing `packages/ui`, `packages/sdk`,
  etc.): `package.json`, `tsconfig.json`, and `src/{index,logger,logging,
  log-helper,trace-context,journey}.ts` (drop the `reference-otel-` prefix
  and `src/` them accordingly).
- `reference-instrumentation.ts` → copy **verbatim** to both
  `apps/ibe-app/instrumentation.ts` and `apps/top-app/instrumentation.ts`
  (identical file, nothing app-specific inside it — the app is identified
  via the `OTEL_SERVICE_NAME` env var instead, set per app).
- `reference-otel-docker-compose.yml` / `reference-otel-collector-config.yaml`
  → copy to `docker-compose.yml` / `otel-collector-config.yaml` at the repo
  root, for a local Jaeger + otel-collector stack (`docker-compose up -d`,
  then browse `http://localhost:16686`).

## Target folder structure (real project)

```
next-cms/                                  (repo root)
├── docker-compose.yml                     ← reference-otel-docker-compose.yml
├── otel-collector-config.yaml             ← reference-otel-collector-config.yaml
│
├── apps/
│   ├── ibe-app/
│   │   ├── instrumentation.ts             ← reference-instrumentation.ts (verbatim)
│   │   └── package.json                   (add "otel": "workspace:*" dependency)
│   │
│   └── top-app/
│       ├── instrumentation.ts             ← reference-instrumentation.ts (verbatim, same file)
│       └── package.json                   (add "otel": "workspace:*" dependency)
│
└── packages/
    └── otel/                              (new workspace package)
        ├── package.json                   ← reference-otel-package.json
        ├── tsconfig.json                  ← reference-otel-tsconfig.json
        └── src/
            ├── index.ts                   ← reference-otel-index.ts
            ├── logger.ts                  ← reference-otel-logger.ts
            ├── logging.ts                 ← reference-otel-logging.ts
            ├── log-helper.ts              ← reference-otel-log-helper.ts
            ├── trace-context.ts           ← reference-otel-trace-context.ts
            └── journey.ts                 ← reference-otel-journey.ts
```

Check the real repo's actual `pnpm-workspace.yaml` before creating
`packages/otel/` — this assumes it uses a `packages/*` layout the same way
this sandbox does.

## Wiring per app

1. Add `packages/otel` as a workspace dependency to both
   `apps/ibe-app/package.json` and `apps/top-app/package.json` (`"otel":
   "workspace:*"`), same pattern as their existing `"ui"`/`"cms"` deps.
2. Env vars (add to each app's `.env.example` / real env, and to the
   `IBE_DEVELOP_*`/`IBE_RELEASE_*`/`TOP_DEVELOP_*`/`TOP_RELEASE_*` ECS task
   definitions this backlog already tracks):
   ```
   OTEL_SERVICE_NAME=ibe-app        # or top-app
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318   # local dev only — see "Open items" below for production
   ```

## Tracing into the backend

`@vercel/otel`'s auto-instrumentation wraps `fetch`/`http` and injects the
W3C `traceparent` header on every outbound request automatically — **no
custom code needed on our side** to send it. Registering `otel` in each
app's `instrumentation.ts` is enough to make ibe-app/top-app hold up their
half of a distributed trace.

**The other half is not ours to build.** A single connected trace across
frontend → backend only happens if the backend team's service also:
- Runs its own OTel SDK (their language's equivalent of
  `@opentelemetry/sdk-node` + `getNodeAutoInstrumentations()` — see
  `next-cms`'s `apps/api/src/instrumentation.ts` for the Node/Express
  version of this, if useful as a reference to hand them).
- Extracts the incoming `traceparent` header and continues that trace
  instead of starting its own.
- Exports its spans to wherever this org's traces end up (see Splunk item
  below) — if their spans land in a different backend than ours, the trace
  still won't visibly connect even if both sides technically propagate it
  correctly.

**Action needed:** loop in the backend team with this requirement before
calling cross-service tracing "done" — from our side alone, we can confirm
the header goes out, but not that anything connects it into one trace.

## Open items — need input before this is production-ready

- **Splunk endpoint/auth is unknown.** `createLogger()`'s production output
  is already JSON Lines on stdout — if this org's existing ECS →
  CloudWatch → Splunk log-forwarding pipeline (Splunk Add-on for AWS /
  Cribl / similar) is already in place, **no code change is needed for
  logs specifically** to start showing up in Splunk; confirm that pipeline
  exists rather than assuming it.
- **Traces to Splunk are a separate question from logs**, and need one of:
  - **Splunk Observability Cloud (APM)** — has a native OTLP ingest
    endpoint per realm, needs a realm + access token
    (`https://ingest.<realm>.signalfx.com`, auth via header) — if this is
    what the org uses, `OTEL_EXPORTER_OTLP_ENDPOINT` (+ an auth header)
    gets set to that in production instead of the local collector.
  - **Splunk Enterprise (HEC-only, no O11y Cloud)** — has no native OTLP
    trace ingestion; would need a company-run OTel Collector with a
    `splunk_hec` exporter converting spans into HEC events — meaningfully
    more setup than the O11y Cloud path.
  - **Confirm which of these two this org actually runs** before building
    the production exporter config — guessing wrong here means silently
    losing traces in production with no error, the same silent-failure
    trap this backlog has flagged elsewhere (Snyk fallback, ECR tag
    lookup).
- **Production `OTEL_SERVICE_NAME`/`OTEL_EXPORTER_OTLP_ENDPOINT` values**
  aren't set yet in the real ECS task definitions — blocked on the Splunk
  answer above.
