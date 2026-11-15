# Extracting `ui` and `cms` into their own repos

Each package carries its own `.github/workflows/`, `.changeset/` and
`.npmrc.template`. GitHub ignores nested `.github/` folders, so they do
nothing inside this monorepo; they become live once a package is the root of
its own repo.

## Order

1. **`ui` first** — `cms` depends on it.
2. **`cms` second** — after `ui` has published its first version.

## Steps per package (run from the monorepo root)

```bash
# 1. Split out the package with its git history.
git subtree split --prefix=packages/ui -b extract/ui

# 2. Create the empty GitHub repo (architon-creator/ui), then push the branch to main.
git push git@github.com:architon-creator/ui.git extract/ui:main
```

After pushing, in the new repo:

1. The package names (`@architon-creator/ui`, `@architon-creator/cms`) and the `repository` / registry
   fields are already set. For `cms`, change the `@architon-creator/ui` dependency from
   `workspace:*` to `@architon-creator/ui@^<version>`.
2. Add `"@changesets/cli"` as a devDependency and copy `.npmrc.template` to
   `.npmrc`.
3. Replace the `main`/`types`/`exports` that point at `src/` with the `dist/`
   ones from `publishConfig` (the monorepo only keeps `src/` for no-build dev).
4. `pnpm install`, `pnpm changeset` (pick `minor`/`patch`), merge to `main`.
   The "Version Packages" PR that opens publishes when merged.

## Then, in the web app repo

Replace `"@architon-creator/ui": "workspace:*"` / `"@architon-creator/cms": "workspace:*"` with the published
versions, add the `.npmrc`, and set `CMS_DIR` / `LABELS_MESSAGES` for
`packages/labels-tools` (see its `scripts/paths.ts`).

## Before the first publish

- Regenerate `cms/prismicio-types.d.ts` (`pnpm --filter @architon-creator/cms run types`); it
  currently lists only 8 document types.
