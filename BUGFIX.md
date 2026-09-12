# Bugfix log — for porting to the real project

Fixes found and verified in this repo (`next-cms`) while building the
Prismic-backed label service. Each one was first spotted here, but the
root cause lives in code patterns shared with the real project (the one
with `apps/top-app` + `apps/ibe-app`, `@repo/cms/prismic`, and the shared
"ibe" parent document). Check each "Port to real project" section before
copying — file/import names differ between the two codebases.

---

## 1. Hub override fix (schema + content, two commits)

**Symptom:** Regenerating or reseeding the shared hub document (`app_labels`
here, `"ibe"` in the real project) from one app's label source silently
deletes the other app's Link fields — not just leaves them empty, the
fields disappear from the schema/content entirely.

**Root cause:** the hub is shared across every app in `label-source-loader.ts`
(both `top-app` and `ibe-app` point `parentDocumentType` at the same `"ibe"`),
but the generator/seeder built the hub's fields/data from scratch using
_only the current `--source`'s_ documents each run, then wrote that as the
whole schema/data — a replace-write, not a merge.

### 1a. Schema side — commit [`7df150b`](../../commit/7df150bb5ba6213fea1fb3377046f7c64824e2e0)

`Fix real bug: generating from one app's source deletes the other's ibe hub links`

- File: `packages/cms/scripts/generate-prismic-models.ts` (this is the
  **verbatim baseline copy of the real project's own script** — same
  `createIbeModel()`, same `@repo/cms/prismic` import, same
  `apps/top-app`/`apps/ibe-app` paths in `label-source-loader.ts`. This
  fix was written and verified against that copy directly.)
- Fix: added `getAllPrismicLabelSources()` to `label-source-loader.ts`
  (returns every registered source, not just the one `--source` resolves
  to). `generate-prismic-models.ts` now builds the `ibe` model from the
  **union** of every source's documents (deduped by `modelId`) via a new
  `getAllSourceDocuments()` helper — instead of the current invocation's
  `documents` alone. Per-app leaf-type generation is untouched (it was
  already correctly scoped to the current source); only the shared hub
  needed the union.

**Port to real project:** apply the same diff to the real
`generate-prismic-models.ts` + `label-source-loader.ts` — the code in
this commit _is_ the real project's code, so it should apply close to
as-is. Watch for indentation: this repo reformatted both files from
4-space to 2-space as a side effect (noted in the commit message);
diff logic, not whitespace.

### 1b. Content side — commit [`6a269db`](../../commit/6a269db9069de60357acdb4cd1e3425d4eb91765)

`Fix demo hub content write: fetch-merge-write, not replace-write`

- File: `packages/cms/scripts/seed-prismic-content-demo.ts` (**this one
  is the demo-only seeder** — the real project's equivalent write path
  was _not_ identified/fixed in this session; see "still needed" below).
- Same bug, one layer down: `hubData` started from `{}` each run instead
  of the hub's existing remote data. Fix: seed `hubData` from
  `{ ...existingHub?.data }` first, then overlay only this run's own
  keys on top. Moved the `existingHub` lookup earlier so it's available
  before `hubData` is built.

```ts
// before
const hubData: Record<string, unknown> = {};
// ...
const existingHub = await findExistingSingleton(readClient, HUB_TYPE_ID);

// after
const existingHub = await findExistingSingleton(readClient, HUB_TYPE_ID);
const hubData: Record<string, unknown> = { ...existingHub?.data };
// ...(existingHub lookup removed from its old later position)
```

**Port to real project — still open:** the commit message flags this
explicitly — find whatever script _actually writes_ the `"ibe"`
document's content in the real project (not `seed-prismic-content.ts`,
which only handles leaf documents there) and apply the same
fetch-merge-write pattern to it. This wasn't identified in this session
because that script wasn't available to inspect.

---

## 2. Format fix — `npx prismic pull` rewrites every custom-type file with no real changes

**Symptom:** Running `prismic pull` with zero remote changes still
rewrites every generated custom-type JSON file, showing up as noisy
diffs / formatter complaints (reported against Biome in the real
project) on every pull.

**Root cause:** `prismic pull` writes JSON keys in a fixed order that's
**not** insertion order:

- Top level: alphabetical — `format, id, json, label, repeatable, status`
- Within each field definition: `config` before `type`, and alphabetical
  _within_ `config` (e.g. `customtypes` before `label` before `select`)
- Field order **inside** `Main` itself is preserved as-is, not sorted —
  only the model's own top-level keys and each field definition's keys
  get reordered.

The generator (`generate-prismic-models-demo.ts`'s `createModel()` /
`createHubModel()`) was emitting keys in insertion order, which never
matches this, so every pull looked like a change even when nothing
remote had actually changed. A downstream formatter (Prettier here,
Biome in the real project) can't fix this — formatters preserve existing
key order, they don't sort object keys.

**Fix — commit [`f74100c`](../../commit/f74100cff2cc851ebbcbdb2ebf2008fa7cf18e23)**
`Fix generator output to match prismic pull's own JSON key ordering`

Updated `createModel()` / `createHubModel()` to emit keys in that exact
order:

```ts
// field definitions: config before type, alphabetical within config
{
  config: { customtypes: [modelId], label: "...", select: "document" }, // alphabetical
  type: "Link",
}

// top-level model object: alphabetical
{
  format: "custom",
  id: modelId,
  json: { Main: fields },
  label: "...",
  repeatable: false,
  status: true,
}
```

Verified end-to-end: after regenerating and committing, `prismic pull`
on `next-js-ssr` no longer touched any of the 7 generated files at all
(byte-for-byte identical before/after a pull that only blocked on
unrelated pre-existing slice drift).

**Port to real project:** find the equivalent generator there (likely
`generate-prismic-models.ts` itself, or wherever it writes
`customtypes/*/index.json`) and apply the same key-order rule to its
model-building functions. This should directly resolve the Biome
"format mismatch on every pull" complaint — it's a Prismic CLI behavior,
not specific to Prettier vs. Biome.

---

## Also fixed this session (not requested for porting, but related)

Wiring the frontend's `i18n` to actually use the label service (commit
[`aa350b3`](../../commit/aa350b3), plus an uncommitted follow-up deriving
the namespace remap dynamically in `apps/frontend/i18n/load-messages.ts`
instead of hand-listing it) surfaced two more latent bugs in
`packages/cms`:

- `create-client.ts` / `repository.ts` / `write-client.ts` imported each
  other with `.js` extensions, which `tsc`/`tsx` silently remap but
  webpack doesn't — breaks the Next.js build the first time anything
  actually bundles that code path through Next rather than running it
  via `tsx`.
- `config.ts`'s Prismic repository name defaulted to a hardcoded
  `"zipair-dev"` when `PRISMIC_REPOSITORY_NAME` was unset — almost
  certainly correct as the real project's actual default, so **probably
  not a bug to port** — just worth knowing the value is project-specific
  if you ever see it fire unexpectedly.

Not included in the numbered list above since you didn't ask for these
two, but flagging in case the same `.js`-extension pattern exists in the
real project's copy of those three files — that one's a generic bug
worth a quick grep regardless of project.
