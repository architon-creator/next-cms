# Prismic labels (`/labels`)

Turns `apps/frontend/messages/en.json` into Prismic custom types and seeds
one document per namespace in the real `next-js-ssr` repository — a UI
wrapper around `packages/cms/scripts/generate-prismic-models-demo.ts` and
`seed-prismic-content-demo.ts`, the same scripts `pnpm --filter cms run
prismic-model-generate` / `prismic-seed-content` already run from a
terminal.

## What it does

Each top-level key in `en.json` (`Header`, `ContactPage`, ...) becomes one
Prismic custom type, one flat Text field per string key, plus an
`app_labels` "hub" type with a Link field per namespace (`packages/cms/src/services/label-service.ts`
fetches labels through this hub, not by querying each type directly).

- **Generate models** — writes local files under `packages/cms/customtypes/`.
  Only ever touches local files, never Prismic itself; safe to re-run
  anytime.
- **Seed content** — creates/updates one singleton document per namespace
  with `en.json`'s real string values, then re-links them all from the
  `app_labels` hub. Defaults to a dry run (preview only); check **Write
  for real** to actually write to Prismic.

Namespaces are diffed against their existing `customtypes/<id>/index.json`
(field *keys* only, not values) and shown as **new** (no model file yet),
**changed** (fields added/removed since last generate), or **up-to-date**
(disabled — nothing to do). Only new/changed namespaces are selectable.

## One-time migration, not an ongoing sync

Generate + Seed is a **one-time migration per namespace**, not a
repeatable content pipeline. Once a namespace's document exists in
Prismic, further content changes belong in Prismic's own dashboard —
edited directly by whoever owns that copy — not by touching `en.json`
and re-running Seed.

This matters because Seed isn't additive: it overwrites the *entire*
document's `data` with whatever `en.json` currently holds for every field
in that namespace, not just the field(s) that changed. Re-seeding an
already-live namespace will silently clobber any edit made directly in
Prismic since it was last seeded, reverting it back to `en.json`'s
(possibly stale) copy.

- **Brand-new namespace** (status **new** — no `customtypes/` file yet):
  Generate → push the schema yourself → Seed once to create the initial
  document. This is the case this tool is actually for.
- **Existing namespace, only en.json's copy changed**: don't re-seed.
  Make the edit directly on the live document in Prismic instead — that's
  the source of truth for content from this point on, not `en.json`.
- **Existing namespace, a field was added/removed** (status **changed**):
  Generate is still needed (the schema itself changed), and push it. Seed
  can be re-run to backfill the new field's initial value, but know that
  it will also re-write every other field on that document from
  `en.json` — confirm nobody has already made a direct Prismic edit to
  this namespace before doing that, or check the values afterward.

## What it does NOT do

**Pushing the generated schema live to Prismic is a manual step.** This UI
can't do it: the local Prismic CLI isn't authenticated in this
environment, and `prismic push`/`login` need an interactive browser flow
that can't be scripted around. After Generate, push the updated
`customtypes/` folder yourself:

```
cd packages/cms
npx prismic login
npx prismic push
```

(or import the generated JSON via Prismic's Type Builder) — *then* run
Seed, since it needs the real field to already exist in Prismic.

## Security notes

- The `namespaces` filter param is strictly validated (letters/digits
  only per entry) before being forwarded to a shell-spawned command — see
  `lib/spawn-log.ts`'s `parseNamespaceListParam`. Don't relax this without
  re-reading why it's there: these scripts run via `spawn(..., { shell:
  true })`, which does not escape shell metacharacters.
- All three `/api/labels/*` routes and this page itself are disabled by
  default outside local development (`lib/labels-guard.ts`) — a production
  deployment must opt in explicitly via `ENABLE_LABELS_TOOL=true`.
- Same as every other admin-app route: **no auth**. Fine for a single
  developer running this locally; not fine to expose to anyone else
  without adding real auth first.
