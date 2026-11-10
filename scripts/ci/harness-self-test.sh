#!/usr/bin/env bash
# The multiplayer harness self-test (was .github/workflows/harness-self-test.yml,
# a 4-job matrix; one job since 11-09, which saves three installs). The
# harness spec must pass with the contract intact ("off") and must DETECT
# each sabotage mode (the spec passes when it catches the break). Every mode
# runs; the exit code is 1 if any failed.
set -uo pipefail
fail=0
for mode in off unstable-order drop-every-7th nan-blind; do
  echo "::group::harness self-test HARNESS_BREAK_MODE=$mode"
  HARNESS_BREAK_MODE=$mode npm run test:harness || { echo "::error::harness self-test failed for HARNESS_BREAK_MODE=$mode"; fail=1; }
  echo "::endgroup::"
done
exit "$fail"
