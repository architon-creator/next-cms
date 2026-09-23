# Fix: don't publish a git tag when build or deploy fails

## The gap

`create_git_tag` currently runs **first**, and its "Create and push tag"
step pushes the tag to the remote immediately — before `build` or `deploy`
even start. If either one later fails, the tag has already been created
and pushed, permanently: a version number gets consumed and a tag exists
in git for a release that was never actually built or deployed.

## The fix

Split the single `reusable-git-tag.yml` into two separate reusable
workflows — added to this branch as:

- [reference-reusable-git-tag-compute-workflow.yml](reference-reusable-git-tag-compute-workflow.yml)
  → copy to `.github/workflows/reusable-git-tag-compute.yml`. Pure
  calculation — figures out the next version string, no git tag created,
  no push. Same internal logic as the current `reusable-git-tag.yml`'s
  "Compute next semantic tag" step, unchanged.
- [reference-reusable-git-tag-publish-workflow.yml](reference-reusable-git-tag-publish-workflow.yml)
  → copy to `.github/workflows/reusable-git-tag-publish.yml`. Does nothing
  BUT create and push the tag, given an already-computed `version_tag`
  input. This is the only place the actual git side effect happens.

Then restructure each app's build workflow so **publish runs last**,
gated on `build` and `deploy` having succeeded:

```
compute_git_tag  →  build  →  deploy  →  publish_git_tag
                                          (needs: build + deploy — only
                                           runs if both actually succeeded)
```

## Exact job changes for `ibe-app-build.yml` (same pattern for `top-app-build.yml`)

**1. Rename `create_git_tag` → `compute_git_tag`, point it at the new compute-only workflow:**

```yaml
compute_git_tag:
  name: Compute Next Git Tag
  if: ${{ github.event_name != 'pull_request' }}
  permissions:
    id-token: write
    contents: read
  uses: ./.github/workflows/reusable-git-tag-compute.yml
  with:
    app_name: ibe-app
    include_ecr_tags: true
    aws_region: ap-northeast-1
    aws_oidc_role_arn: ${{ vars.AWS_OIDC_ROLE_ARN }}
    ecr_repository: ${{ vars.IBE_ECR_REPO }}
```

**2. In `build`, swap every `create_git_tag` reference to `compute_git_tag`:**

```yaml
build:
  name: Build and Push Docker Image for ibe-app
  needs: compute_git_tag
  if: ${{ github.event_name != 'pull_request' }}
  permissions:
    id-token: write
    contents: read
    packages: read
  uses: ./.github/workflows/reusable-app-build.yml
  with:
    ...
    version_tag: ${{ needs.compute_git_tag.outputs.version_tag }}
```

**3. In `deploy`, same swap:**

```yaml
deploy:
  name: Deploy ibe-app to ECS
  needs:
    - build
    - compute_git_tag
  if: ${{ startsWith(github.ref_name, 'develop/') }}
  permissions:
    id-token: write
    contents: read
  uses: ./.github/workflows/reusable-app-deploy.yml
  with:
    ...
    image_tag: ${{ needs.compute_git_tag.outputs.version_tag }}
```

**4. Add a brand new final job — this is what actually publishes the tag, and only when it's safe to:**

```yaml
publish_git_tag:
  name: Publish Git Tag
  needs:
    - compute_git_tag
    - build
    - deploy
  # Deliberately NOT a plain `needs` success check — `deploy` is itself
  # conditional (only runs on develop/*). A skipped job counts as neither
  # success nor failure, and by default a downstream job that lists a
  # skipped dependency is ALSO skipped — which would silently stop tags
  # from ever publishing on any branch where deploy doesn't apply. This
  # condition explicitly treats "deploy skipped" as fine (build's success
  # alone is enough justification to tag), while still blocking on a
  # genuine deploy FAILURE.
  if: |
    always() &&
    needs.compute_git_tag.result == 'success' &&
    needs.build.result == 'success' &&
    (needs.deploy.result == 'success' || needs.deploy.result == 'skipped')
  permissions:
    contents: write
  uses: ./.github/workflows/reusable-git-tag-publish.yml
  with:
    version_tag: ${{ needs.compute_git_tag.outputs.version_tag }}
    force_update: false
```

## Why the `if: always()` on `publish_git_tag` is not a mistake

`always()` here does **not** mean "run regardless of failure" — the three
explicit `.result` checks right after it still gate everything that
matters. What `always()` actually does is override GitHub Actions' default
behavior of auto-skipping a job when *any* of its `needs` didn't
succeed — without it, this job would never even evaluate its own `if`
condition when `deploy` is skipped (the common case on non-`develop/*`
branches), because GitHub would skip it automatically before checking
anything. `always()` just gets `publish_git_tag` a chance to run its own
logic; the `.result ==` checks are what actually decide whether it does
anything once it gets that chance.

## What this buys you

- A failed `build` → nothing downstream runs → **no tag created**. Retry
  after fixing it: `compute_git_tag` recomputes (finds nothing new
  published yet, so it's the same version number as before) → build
  succeeds this time → tag finally gets published. No wasted version
  numbers, no phantom tags.
- A failed `deploy` → same outcome: no tag published until deploy actually
  succeeds.
- On a branch where `deploy` doesn't apply at all (its own `if` condition
  is false) → tag still publishes correctly once `build` succeeds, because
  `deploy.result == 'skipped'` is explicitly treated as acceptable above.

## Not addressed here — out of scope for this specific fix

This branch's own `reference-ibe-app-build-workflow.yml` has since evolved
further than what you showed me from the real project (it now has a `ci`
job and a `resolve_deploy_env` job your real file doesn't have yet, and
resolves the deploy environment dynamically instead of a hardcoded
`production`). The job changes above are written to match your **real
project's current, simpler shape** (as verified from your screenshots),
not this branch's more-evolved reference file. Flagging this drift so it
doesn't cause confusion later — reconciling the two is a separate task,
not part of this fix.
