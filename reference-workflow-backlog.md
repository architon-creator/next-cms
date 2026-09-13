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

## Open
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
  - `reusable-app-build.yml`: two `actions/upload-artifact@v4` steps
    (`image_uri.txt`, `version_tag.txt`) upload artifacts nothing
    downloads anymore — the file's own comment says the consuming
    post-build job was already removed as a no-op.
  - `reusable-git-tag.yml`'s ECR tag lookup swallows AWS failures via
    `2>/dev/null || true` — a transient AWS error is indistinguishable
    from "no images exist yet."
  - Docker build in `reusable-app-build.yml` sets `provenance: false,
    sbom: false` — no attestation trail on images that get deployed.
