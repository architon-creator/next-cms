# Fix: git tag collision between apps sharing a branch

## The bug

`reusable-git-tag.yml` accepts an `app_name` input but — in the unpatched
version — never uses it when building the tag pattern. The tag series was
scoped by **branch alone**, so `ibe-app` and `top-app` pushing to the same
branch (e.g. both on `develop-p1/w1`) read and bumped the *same* version
number, silently colliding on each other's tags.

**Fixed in this repo's own reference copy already** (originally landed as
commit `d99d979`) — this doc exists just to make copying that fix into the
real project's actual `.github/workflows/reusable-git-tag.yml` a single
paste instead of hunting through this branch's other files.

## The fix — full replacement for `reusable-git-tag.yml`

Copy this entire block over the real repo's `.github/workflows/reusable-git-tag.yml`.

```yaml
name: Reusable Git Tag

on:
  workflow_call:
    inputs:
      app_name:
        required: true
        type: string
      include_ecr_tags:
        required: false
        type: boolean
        default: false
      aws_region:
        required: false
        type: string
        default: ''
      aws_oidc_role_arn:
        required: false
        type: string
        default: ''
      ecr_repository:
        required: false
        type: string
        default: ''
      major_minor:
        required: false
        type: string
        default: ''
        # Manual override escape hatch. Leave unset (the default) to have
        # this workflow derive the bump itself from Conventional Commit
        # messages pushed since the last tag in this app+branch series —
        # see the "Compute next semantic tag" step below. Only pass this
        # when you need to force a specific MAJOR.MINOR outside what
        # commit messages alone would produce (e.g. seeding a brand new
        # series, or a deliberate major bump that wasn't marked as such).
      force_update:
        required: false
        type: boolean
        default: false
    outputs:
      version_tag:
        description: Per-app, per-branch semantic version tag created by this workflow.
        value: ${{ jobs.create_tag.outputs.version_tag }}

jobs:
  create_tag:
    runs-on: ubuntu-latest
    outputs:
      version_tag: ${{ steps.compute.outputs.version_tag }}
    permissions:
      id-token: write
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure AWS credentials (OIDC)
        if: ${{ inputs.include_ecr_tags }}
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ inputs.aws_oidc_role_arn }}
          aws-region: ${{ inputs.aws_region }}

      - name: Compute next semantic tag
        id: compute
        shell: bash
        run: |
          set -euo pipefail

          BRANCH_NAME="${GITHUB_REF_NAME}"
          SANITIZED_BRANCH="$(echo "${BRANCH_NAME}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
          SANITIZED_BRANCH="${SANITIZED_BRANCH#-}"
          SANITIZED_BRANCH="${SANITIZED_BRANCH%-}"

          if [ -z "${SANITIZED_BRANCH}" ]; then
            SANITIZED_BRANCH="branch"
          fi

          # Sanitized the same way as the branch name, and folded into every
          # tag lookup/creation below alongside it. Previously `app_name`
          # was accepted as an input but never actually used here, so the
          # tag series was scoped by branch alone — two apps sharing a
          # branch (e.g. both pushing to develop-p1/w1) would read each
          # other's patch numbers and collide on the same next tag.
          SANITIZED_APP="$(echo "${{ inputs.app_name }}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
          SANITIZED_APP="${SANITIZED_APP#-}"
          SANITIZED_APP="${SANITIZED_APP%-}"

          if [ -z "${SANITIZED_APP}" ]; then
            SANITIZED_APP="app"
          fi

          TAG_PREFIX="${SANITIZED_APP}-${SANITIZED_BRANCH}"
          ESCAPED_PREFIX="$(printf '%s' "${TAG_PREFIX}" | sed -E 's/[][(){}.^$?+*|\\/]/\\\\&/g')"
          TAG_REGEX="^${ESCAPED_PREFIX}-([0-9]+)\.([0-9]+)\.([0-9]+)$"

          git fetch --tags --force

          # Enterprise guard: if this commit already has a matching release tag
          # anywhere in this app+branch series, reuse it instead of computing
          # a new one (covers reruns/retries of the same commit).
          EXISTING_HEAD_TAG=""
          while IFS= read -r tag; do
            [ -n "${tag}" ] || continue
            if [[ "${tag}" =~ ${TAG_REGEX} ]]; then
              EXISTING_HEAD_TAG="${tag}"
              break
            fi
          done < <(git tag --points-at HEAD)

          if [ -n "${EXISTING_HEAD_TAG}" ]; then
            echo "Reusing existing tag on HEAD: ${EXISTING_HEAD_TAG}"
            echo "version_tag=${EXISTING_HEAD_TAG}" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          # Highest existing version in this app+branch series (or 0.0.0 if
          # this is the series' first tag). --sort=-v:refname is a version-
          # aware sort, so this correctly orders e.g. ...-0.10.0 above
          # ...-0.9.0 despite the plain-string comparison being the other
          # way round.
          LATEST_TAG="$(git tag -l "${TAG_PREFIX}-*" --sort=-v:refname | grep -E "${TAG_REGEX}" | head -n1 || true)"

          if [ -n "${LATEST_TAG}" ] && [[ "${LATEST_TAG}" =~ ${TAG_REGEX} ]]; then
            CURRENT_MAJOR="${BASH_REMATCH[1]}"
            CURRENT_MINOR="${BASH_REMATCH[2]}"
            CURRENT_PATCH="${BASH_REMATCH[3]}"
          else
            CURRENT_MAJOR=0
            CURRENT_MINOR=0
            CURRENT_PATCH=0
          fi

          if [ -n "${{ inputs.major_minor }}" ]; then
            # Manual override: caller pinned MAJOR.MINOR explicitly. Patch
            # still auto-increments within that pinned pair, same as this
            # workflow's original (pre-auto-detect) behavior.
            if [[ "${{ inputs.major_minor }}" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
              NEXT_MAJOR="${BASH_REMATCH[1]}"
              NEXT_MINOR="${BASH_REMATCH[2]}"
            else
              echo "::error::major_minor override '${{ inputs.major_minor }}' is not MAJOR.MINOR"
              exit 1
            fi

            if [ "${NEXT_MAJOR}" -eq "${CURRENT_MAJOR}" ] && [ "${NEXT_MINOR}" -eq "${CURRENT_MINOR}" ]; then
              NEXT_PATCH=$((CURRENT_PATCH + 1))
            else
              NEXT_PATCH=0
            fi

            echo "Using manual major_minor override: ${NEXT_MAJOR}.${NEXT_MINOR}"
          else
            # Auto-detect the bump type from an explicit checkbox in the PR
            # description — see .github/pull_request_template.md:
            #
            #   - [ ] major
            #   - [ ] minor
            #   - [ ] patch
            #
            # This depends on the repo's squash-merge default commit message
            # being set to "Pull request title and description" (Settings ->
            # General -> Pull Requests) — that's what actually puts the PR
            # description's text into the squashed commit's body, which is
            # all `git log` sees here. Without that setting, this step will
            # always fail with "no bump type selected."
            #
            # Deliberately explicit rather than inferred from commit-message
            # text (a prior version of this workflow scanned for `feat:`/
            # `feat!:`/`BREAKING CHANGE:` patterns): checkbox intent can't be
            # misparsed, and the build hard-fails instead of silently
            # defaulting when nobody made a decision — the exact problem
            # that led to major/minor being frozen at 0.0 in the first
            # place.
            if [ -n "${LATEST_TAG}" ]; then
              COMMIT_RANGE="${LATEST_TAG}..HEAD"
            else
              # First tag ever in this series — nothing to diff against, so
              # only look at HEAD's own commit rather than the whole branch
              # history back to the repo root.
              COMMIT_RANGE="HEAD~1..HEAD"
            fi

            COMMIT_MESSAGES="$(git log ${COMMIT_RANGE} --pretty=format:'%B' 2>/dev/null || true)"

            CHECKED_MAJOR=0
            CHECKED_MINOR=0
            CHECKED_PATCH=0
            echo "${COMMIT_MESSAGES}" | grep -qiE '^[-*] \[[xX]\] *major\b' && CHECKED_MAJOR=1
            echo "${COMMIT_MESSAGES}" | grep -qiE '^[-*] \[[xX]\] *minor\b' && CHECKED_MINOR=1
            echo "${COMMIT_MESSAGES}" | grep -qiE '^[-*] \[[xX]\] *patch\b' && CHECKED_PATCH=1
            CHECKED_COUNT=$((CHECKED_MAJOR + CHECKED_MINOR + CHECKED_PATCH))

            if [ "${CHECKED_COUNT}" -eq 0 ]; then
              echo "::error::No version-bump checkbox (major/minor/patch) was checked in the PR description for this commit. Check exactly one before merging. (If this keeps failing, confirm the repo's squash-merge default commit message includes the PR description — Settings > General > Pull Requests.)"
              exit 1
            elif [ "${CHECKED_COUNT}" -gt 1 ]; then
              echo "::error::More than one version-bump checkbox was checked in the PR description. Check exactly one (major, minor, or patch)."
              exit 1
            elif [ "${CHECKED_MAJOR}" -eq 1 ]; then
              BUMP="major"
            elif [ "${CHECKED_MINOR}" -eq 1 ]; then
              BUMP="minor"
            else
              BUMP="patch"
            fi

            case "${BUMP}" in
              major)
                NEXT_MAJOR=$((CURRENT_MAJOR + 1))
                NEXT_MINOR=0
                NEXT_PATCH=0
                ;;
              minor)
                NEXT_MAJOR="${CURRENT_MAJOR}"
                NEXT_MINOR=$((CURRENT_MINOR + 1))
                NEXT_PATCH=0
                ;;
              *)
                NEXT_MAJOR="${CURRENT_MAJOR}"
                NEXT_MINOR="${CURRENT_MINOR}"
                NEXT_PATCH=$((CURRENT_PATCH + 1))
                ;;
            esac

            echo "Detected bump type: ${BUMP} (checkbox in commit body, range ${COMMIT_RANGE})"
          fi

          # ECR safety net: if an image is already published tagged with the
          # version just computed, keep bumping patch until we land on one
          # that isn't — guards against a rerun landing on a tag whose image
          # already shipped under a different git tag.
          if [ "${{ inputs.include_ecr_tags }}" = "true" ]; then
            ECR_TAGS="$(aws ecr describe-images \
              --repository-name "${{ inputs.ecr_repository }}" \
              --region "${{ inputs.aws_region }}" \
              --query 'imageDetails[].imageTags' \
              --output json | jq -r '.[]?[]?' 2>/dev/null || true)"

            while :; do
              CANDIDATE="${TAG_PREFIX}-${NEXT_MAJOR}.${NEXT_MINOR}.${NEXT_PATCH}"
              if echo "${ECR_TAGS}" | grep -qxF "${CANDIDATE}"; then
                NEXT_PATCH=$((NEXT_PATCH + 1))
              else
                break
              fi
            done
          fi

          VERSION_TAG="${TAG_PREFIX}-${NEXT_MAJOR}.${NEXT_MINOR}.${NEXT_PATCH}"
          echo "version_tag=${VERSION_TAG}" >> "$GITHUB_OUTPUT"

      - name: Create and push tag
        shell: bash
        run: |
          set -euo pipefail

          TAG_NAME="${{ steps.compute.outputs.version_tag }}"
          git fetch --tags --force

          REMOTE_TAG_EXISTS=false
          if git ls-remote --tags origin "refs/tags/${TAG_NAME}" | grep -q "refs/tags/${TAG_NAME}$"; then
            REMOTE_TAG_EXISTS=true
          fi

          if [ "${REMOTE_TAG_EXISTS}" = "true" ]; then
            if [ "${{ inputs.force_update }}" = "true" ]; then
              git tag -d "${TAG_NAME}" || true
              git push origin ":refs/tags/${TAG_NAME}" || true
            else
              echo "Tag ${TAG_NAME} already exists on remote. Skipping creation."
              exit 0
            fi
          fi

          if git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
            git tag -d "${TAG_NAME}" || true
          fi

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"

          if [ "${{ inputs.force_update }}" = "true" ]; then
            git push origin "${TAG_NAME}" --force
          else
            git push origin "${TAG_NAME}"
          fi
```

## Also confirm: each app's build workflow must pass `app_name` distinctly

The fix above is useless if both callers pass the same (or no) `app_name`.
Confirm your real `ibe-app-build.yml` and `top-app-build.yml` each call it
like this — **note the different `app_name` value in each**:

```yaml
# apps/ibe-app's build workflow
create_git_tag:
  uses: ./.github/workflows/reusable-git-tag.yml
  with:
    app_name: ibe-app
    include_ecr_tags: true
    aws_region: ap-northeast-1
    aws_oidc_role_arn: ${{ vars.AWS_OIDC_ROLE_ARN }}
    ecr_repository: ${{ vars.IBE_ECR_REPO }}
    force_update: false
```

```yaml
# apps/top-app's build workflow
create_git_tag:
  uses: ./.github/workflows/reusable-git-tag.yml
  with:
    app_name: top-app
    include_ecr_tags: true
    aws_region: ap-northeast-1
    aws_oidc_role_arn: ${{ vars.AWS_OIDC_ROLE_ARN }}
    ecr_repository: ${{ vars.TOP_ECR_REPO }}
    force_update: false
```

## Heads-up: old tags don't get renamed retroactively

Any tags already created under the old, unscoped pattern (e.g.
`develop-p1-w1-1.2.0`, with no app prefix) stay exactly as they are — this
fix only changes how *new* tags get created going forward. Expect a one-time
naming discontinuity in tag history at the point you deploy this fix
(old tags: no app prefix; new tags: `ibe-app-...` / `top-app-...`), not
something requiring active cleanup.
