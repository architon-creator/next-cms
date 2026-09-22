# OTel integration — ibe-app / top-app

Ported from `next-cms`'s own OTel work (commits `72e84e0`, `17a37a6` on its
`master`), adapted for this project's shape: two Next.js apps
(`ibe-app`, `top-app`) with no backend in this repo — the backend is owned
by another team. This doc is the full runbook: what to copy where, how to
wire it up, how to verify it locally, and what's still blocked on other
people before it's production-ready.

**Scope of this copy: logger only.** `journey_id` and
`external_correlation_id` support are deliberately NOT included here —
they're planned as a later, separate integration. The full version with
`journey_id` wired in (via `journey.ts`) is preserved at the
`backup/otel-logger-with-journey` git tag on this branch; restore from
there when that work starts instead of rebuilding it from scratch.
(`external_correlation_id` was previously removed entirely as dead code —
see commit `d0d9e26`.)

## What's in this folder

Everything under `reference-real-project-otel/` mirrors its target path in
the real project 1:1 (see the tree below) — copy the whole folder's
contents into the real repo root and every file lands where it needs to.

- `packages/otel/` → a new workspace package (same role as this repo's
  existing `packages/ui`, `packages/sdk`, etc.).
  - **Deliberately NOT included:** `otel/logging` (a subpath export for a
    plain Node/Express consumer, like `next-cms`'s own `apps/api`). Neither
    `ibe-app` nor `top-app` is a plain-Node service — both are Next.js apps
    that import the package's main entry directly (`import { createLogger }
    from "otel"`). Only add a `logging.ts` + the matching `"./logging"`
    entry in `package.json`'s `exports` if this monorepo ever gains its own
    non-Next.js Node service.
  - **Also not included:** `journey.ts` (see scope note above).
- `instrumentation.ts` → copy **verbatim** to both
  `apps/ibe-app/instrumentation.ts` and `apps/top-app/instrumentation.ts`
  (identical file, nothing app-specific inside it — the app is identified
  via the `OTEL_SERVICE_NAME` env var instead, set per app).
- `docker-compose.yml` / `otel-collector-config.yaml` → copy to the real
  repo's root, for a local Jaeger + otel-collector stack.

## Target folder structure (real project)

```
next-cms/                                  (repo root)
├── docker-compose.yml                     ← reference-real-project-otel/docker-compose.yml
├── otel-collector-config.yaml             ← reference-real-project-otel/otel-collector-config.yaml
│
├── apps/
│   ├── ibe-app/
│   │   ├── instrumentation.ts             ← reference-real-project-otel/instrumentation.ts
│   │   ├── .env.local                     (add OTEL_SERVICE_NAME=ibe-app, see below)
│   │   └── package.json                   (add "otel": "workspace:*" dependency)
│   │
│   └── top-app/
│       ├── instrumentation.ts             ← reference-real-project-otel/instrumentation.ts (same file)
│       ├── .env.local                     (add OTEL_SERVICE_NAME=top-app, see below)
│       └── package.json                   (add "otel": "workspace:*" dependency)
│
└── packages/
    └── otel/                              ← reference-real-project-otel/packages/otel/ (copy whole dir)
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── logger.ts
            ├── log-helper.ts
            └── trace-context.ts
```

Check the real repo's actual `pnpm-workspace.yaml` before creating
`packages/otel/` — this assumes it uses a `packages/*` layout the same way
this sandbox does.

## Step-by-step checklist

### 1. Copy the files (above)

### 2. Wire each app
- Add `"otel": "workspace:*"` to `apps/ibe-app/package.json` and
  `apps/top-app/package.json`'s `dependencies`, same pattern as their
  existing `"ui"`/`"cms"` workspace deps.
- Add to each app's **local** env (`.env.local`, not committed):
  ```
  # apps/ibe-app/.env.local
  OTEL_SERVICE_NAME=ibe-app
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

  # apps/top-app/.env.local
  OTEL_SERVICE_NAME=top-app
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  ```
  Port 4318, not 4317: `@vercel/otel`'s exporter only speaks OTLP/HTTP.
  `OTEL_SERVICE_NAME` is what makes each app show up as a distinct,
  named service in Jaeger's UI — without it, spans fall back to the
  literal string `"unknown-service"` and both apps' traces become
  indistinguishable from each other.

### 3. Verify locally
1. `docker-compose up -d` at the repo root — starts Jaeger + the
   otel-collector.
2. Run `ibe-app` and `top-app` (`pnpm dev` or however this repo normally
   starts them).
3. Click around each app for a bit — load a few pages, submit a form,
   whatever's easy.
4. Open `http://localhost:16686` (Jaeger UI).
5. In the **Service** dropdown, confirm you see **both** `ibe-app` and
   `top-app` listed separately (not merged into one, not showing up as
   `unknown-service`).
6. Click into a trace for each — confirm spans exist, timestamps look
   right, and (for a route that logs something) the log's `trace_id`
   matches the trace's ID in Jaeger.

If a service doesn't show up at all: check `OTEL_EXPORTER_OTLP_ENDPOINT`
is actually set and the app was restarted after adding it (env vars are
read at process startup, not hot-reloaded). If it shows up as
`unknown-service`: `OTEL_SERVICE_NAME` wasn't picked up — same
restart-after-env-change check.

### 4. Decide if you need CSR trace continuity (optional, your call)
Only relevant if some client-side (`"use client"`) action should connect
into the same trace as the request that rendered the page — e.g. a button
click's resulting API call showing up as part of the same Jaeger trace as
the page load, instead of as its own disconnected trace.

- **Why this is even a question:** OTel's auto-instrumentation only patches
  `fetch`/`http` on the **server** (where `register()` ran). A `"use
  client"` component's `fetch()` runs in the **browser**, which has no OTel
  SDK — so it sends no `traceparent` header, and the server treats that
  incoming request as brand new, inventing a fresh trace_id instead of
  continuing whatever trace the page load already started.
- **The fix, if you want it:** `trace-context.ts`'s `generateTraceparent()`
  is a tiny, dependency-free function safe to run in the browser. Call it
  before the `fetch()`, attach the result as a `traceparent` header:
  ```ts
  import { generateTraceparent } from "otel/trace-context";

  fetch(url, { headers: { traceparent: generateTraceparent() } });
  ```
  The receiving server's OTel instrumentation doesn't care that this
  header was hand-written in plain JS instead of produced by a "real"
  tracer — the W3C Trace Context format is trusted at face value, so this
  works.
- If nothing client-side needs to kick off its own traced call, skip this
  — everything still works, you just get two separate traces (page load,
  then click) instead of one connected one.

### 5. Open as its own PR
Branch: `feature/otel-integration` — kept separate from the axe-linter
ruleset fix and the Slack scan-notification work (different branches
already), since these are independent, unrelated changes with different
risk surfaces.

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

## Service naming — one frontend, two services

Even though `ibe-app` and `top-app` are both "the frontend" from a
business/architecture standpoint, keep their `OTEL_SERVICE_NAME` values
**distinct** (`ibe-app`, `top-app`), not shared. Sharing one name merges
both apps' spans into one Jaeger bucket, making it impossible to tell
which actual running process handled a given request. If you also want
"these two are related" visible in the trace backend without losing that
distinction, that's what OTel's `service.namespace` resource attribute is
for (e.g. both set `service.namespace: frontend`, while keeping different
`service.name` values) — `@vercel/otel`'s `registerOTel({ serviceName })`
shorthand doesn't expose this directly; it needs a full
`resourceAttributes` object instead. Not done in this reference port —
flag if you want it added.

## Open items — need input before this is production-ready

- **`reusable-app-deploy.yml` not yet shared** — this is what actually
  shows where/how to add `OTEL_SERVICE_NAME` (and other env vars) into the
  real ECS task definitions for `ibe-app`/`top-app`. It's a static,
  non-secret, never-changes-per-environment value (`ibe-app` is always
  `ibe-app`), so it doesn't belong in the `IBE_DEVELOP_*`/`IBE_RELEASE_*`
  GitHub Actions Variables this backlog already tracks — likely just a
  plain hardcoded environment entry in the task definition, but can't
  confirm the exact mechanism (static JSON template? built inline in the
  workflow? via a `render-task-definition` action?) without seeing that
  file.
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
- **Backend team coordination** (see "Tracing into the backend" above) —
  not started yet.
