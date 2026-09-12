#!/usr/bin/env bash
# Automates the manual CLI safety checks done by hand during development:
# every one of these must fail loudly (non-zero exit, clear message)
# BEFORE any network call is attempted, using fake credentials — this
# is what makes the adjacency/direction/configured-environment guards in
# lib/environments.ts an enforced part of the CI-tested process, not
# just something a human happened to check once.
set -euo pipefail

export DEV_REPOSITORY=fake-dev
export DEV_MIGRATION_TOKEN=fake-dev-token
export SIT_REPOSITORY=fake-sit
export SIT_MIGRATION_TOKEN=fake-sit-token
export UAT_REPOSITORY=fake-uat
export UAT_MIGRATION_TOKEN=fake-uat-token

fail_count=0

# assert_fails <description> <expected-message-substring> <args...>
assert_fails() {
  local description="$1"
  local expected="$2"
  shift 2
  local output
  if output=$(pnpm cli "$@" 2>&1); then
    echo "FAIL: $description — expected a non-zero exit, but the command succeeded"
    echo "$output"
    fail_count=$((fail_count + 1))
    return
  fi
  if ! echo "$output" | grep -qF "$expected"; then
    echo "FAIL: $description — exited non-zero as expected, but didn't mention \"$expected\""
    echo "$output"
    fail_count=$((fail_count + 1))
    return
  fi
  echo "OK: $description"
}

assert_fails \
  "missing --from/--to is rejected" \
  "Both --from=<env> and --to=<env> are required." \
  migrate

assert_fails \
  "a non-adjacent pair (skip-tier) is rejected" \
  "not adjacent" \
  migrate --from=dev --to=uat

assert_fails \
  "an environment not in the configured chain is rejected" \
  "not part of the configured environment chain" \
  migrate --from=dev --to=staging

assert_fails \
  "migrate given the backward direction is rejected, naming backsync" \
  "Use backsync for that direction instead" \
  migrate --from=sit --to=dev

assert_fails \
  "backsync given the forward direction is rejected, naming migrate" \
  "Use migrate for that direction instead" \
  backsync --from=dev --to=sit

if [ "$fail_count" -gt 0 ]; then
  echo ""
  echo "$fail_count CLI safety check(s) failed."
  exit 1
fi

echo ""
echo "All CLI safety checks passed."
