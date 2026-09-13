# Real-project CI/CD workflow fixes — backlog

Tracking issues found while reviewing the real project's GitHub Actions
pipeline (see the `reference-*.yml` files in this branch). Fixed items are
struck through with the commit that fixed them; open items are next up.

## Fixed
- ~~Same git tag generated for two different apps sharing a branch~~ —
  `reusable-git-tag.yml` never actually used the `app_name` input in the
  tag name/regex, so tags were scoped by branch only. Fixed in `d99d979`.
- ~~Redundant `resolve_release_tag` job~~ — duplicated (and equally
  unscoped) tag-resolution logic instead of using `create_git_tag`'s own
  output. Removed in `d99d979`.
- ~~`deploy` only triggered on `develop/**`, always to `environment:
  production`, always the same ECS cluster/service/task-family/container-
  name regardless of branch~~ — added `resolve_deploy_env` to split
  develop-*/release-* deploy targets and Environment name. Fixed in
  `b559264`.
- ~~No Turborepo caching, so the push-triggered `ci` run always fully
  re-executes lint/type-check/test even when the code is byte-identical
  to what the PR's run already validated~~ — chose the GitHub Actions
  cache over Turborepo Remote Caching (Vercel's) to avoid needing a new
  third-party account. Added an `actions/cache@v4` step in
  `reusable-ci.yml` caching `.turbo` (Turbo's local cache dir), keyed on
  `github.sha` with an OS-only `restore-keys` fallback. No new secrets/
  variables needed — works as soon as this merges. Weaker than Remote
  Caching (scoped per-runner, subject to GitHub's cache eviction, exact
  key won't match across a squash-merge's new SHA — relies on the
  `restore-keys` prefix pulling in *some* prior `.turbo` dir that
  happens to contain matching task hashes), but zero setup cost.
  **Verified** with a standalone local Turborepo simulation: cold run →
  `cache miss, executing <hash>` (real execution, ~3.5s); rerun with no
  source changes → `cache hit, replaying logs <hash>` (same hash, 42ms,
  no real execution); rerun after actually changing a file → new hash,
  `cache miss` again. Confirms cache hits only happen when nothing
  relevant changed.

## Fixed (cont.)
- ~~`major_minor: 0.0` hardcoded by every caller, so tags were never real
  semantic versions~~ — patch auto-incremented forever but major/minor
  never moved, so nothing ever signaled a breaking change or a new
  feature. `reusable-git-tag.yml` now derives the bump itself from
  Conventional Commit messages pushed since the series' last tag: a
  `BREAKING CHANGE:` footer or `!` before the `:` (e.g. `feat!:`) bumps
  major, a plain `feat:` bumps minor, everything else bumps patch — same
  classification semantic-release/Changesets use, without needing either
  tool since PR titles are already enforced as Conventional Commits.
  `major_minor` stays as an optional manual override for edge cases (e.g.
  seeding a new series) instead of being forced on every call. Both
  `ibe-app-build.yml` and `top-app-build.yml` no longer pass it.
  **Verified** with a standalone local simulation: a `fix:`/`chore:`
  commit bumps patch, `feat:` bumps minor and resets patch, `feat!:` and
  a `BREAKING CHANGE:` footer both bump major and reset minor+patch, and
  rerunning on an already-tagged HEAD correctly reuses the existing tag
  instead of double-bumping.
- ~~Dead artifact uploads in `reusable-app-build.yml`~~ — removed the
  "Save/Upload image URI artifact" and "Save/Upload version tag
  artifact" steps (`image_uri.txt`/`version_tag.txt`), which nothing
  downloaded anymore since the consuming post-build job was already
  removed as a no-op. `version_tag` is still available to every caller
  via this workflow's own `outputs.version_tag`; the image URI is
  trivially reconstructible from `ecr_repository`/`aws_account_id`/
  `aws_region`/`version_tag`, which callers already have. Fixed in
  `e2197c6`.

## Open — waiting on the user
- **Version doesn't survive promotion across branches** — the patch
  counter (and now the auto-detected major/minor) is scoped per
  `(app, branch)` pair, since `TAG_PREFIX` includes the branch name. So
  e.g. `ibe-app-develop-p1-w1-0.3.2` and `ibe-app-release-p1-w1-0.1.0`
  are two independent series: promoting a build from develop to release
  doesn't carry its version forward, it starts a fresh count on the new
  branch's series. Deferred — not tackled yet; flagging so it doesn't get
  lost.
- **Waiting on `reusable-app-deploy.yml`** (user will share it) — need to
  verify its job actually declares `environment: ${{ inputs.environment }}`
  at the job level. Without that, the `staging`/`production` Environment
  names `resolve_deploy_env` now produces don't actually wire up to
  GitHub's Required-reviewers approval gate — they'd just be inert labels.
- **New GitHub repo/org Variables not yet created**: `IBE_DEVELOP_*` /
  `IBE_RELEASE_*` and `TOP_DEVELOP_*` / `TOP_RELEASE_*` for
  `ECS_CLUSTER`, `SERVICE_NAME`, `TASK_FAMILY`, `CONTAINER_NAME` (8 per
  app, 16 total). Until these exist, `vars.X` resolves to an empty string.
- **Manual approval on `production` Environment not yet configured** —
  Settings -> Environments -> production -> Required reviewers.
- Other findings from the original review not yet tackled (see the
  conversation for full detail, ranked by severity):
  - `pnpm install --no-frozen-lockfile` in `reusable-ci.yml` — lets CI
    silently drift from a stale lockfile instead of failing fast.
  - Coverage file lookup in `reusable-ci.yml` is unscoped
    (`find . -name coverage-summary.json | head -n 1` across the whole
    repo) and fails silently (no failure, no summary) if nothing is found.
  - Accessibility (Axe Linter) step isn't gated on `ACCESSIBILITY_API_KEY`
    being set, unlike the Snyk step's `SNYK_TOKEN_AVAILABLE` pattern —
    likely fails outright for any caller that doesn't set that secret.
  - `reusable-git-tag.yml`'s ECR tag lookup swallows AWS failures via
    `2>/dev/null || true` — a transient AWS error is indistinguishable
    from "no images exist yet."
  - Docker build in `reusable-app-build.yml` sets `provenance: false,
    sbom: false` — no attestation trail on images that get deployed.
