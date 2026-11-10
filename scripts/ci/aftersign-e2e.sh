#!/usr/bin/env bash
# The AFTERSIGN WebGL e2e and the checks that read its output (was inline in
# .github/workflows/ci.yml; moved 11-09 when the game's workflows became
# rendered from the oodim repo profile, which runs plain shell steps only).
#
#   1. the e2e, tee'd so the failure summary can quote the raw log (#1065);
#   2. on a PR with a green e2e: the rendered-text rule (blocking since 11-01,
#      game #2511/#2529): every new player-facing string must be SHOWN in a
#      served playtest, reached through real input;
#   3. on a PR: the CI-evidence block in the PR body (report only);
#   4. on a red e2e: the failure summary to the run page, and on a PR as a
#      PR comment (agents can't read run logs).
#
# usage: bash scripts/ci/aftersign-e2e.sh npm run test:e2e:aftersign
# (the e2e command is an argument so ci.yml names it, which
# scripts/check-product-wiring.mjs reads).
# Env from the workflow: EVENT_NAME, PR_NUMBER, GITHUB_TOKEN, GH_TOKEN,
# GATE_EXEMPT_APPROVERS, SERVED_RESULT, SERVED_COUNTS, SERVED_EXEMPT.
# The rendered-text output lands in ci-artifacts/ (uploaded with the job).
set -uo pipefail
if [ "$#" -eq 0 ]; then
  echo "usage: $0 <e2e command...>" >&2
  exit 2
fi

mkdir -p ci-artifacts
# Turns on the rendered-text recorder in the test build only
# (aftersign/vite.config.ts); the deploy never sets it.
export AFTERSIGN_RENDERED_OUT="$PWD/ci-artifacts/aftersign-rendered.jsonl"
runner_log=/tmp/aftersign-e2e-runner.log
rendered_log=/tmp/rendered-reach.log

"$@" 2>&1 | tee "$runner_log"
e2e=${PIPESTATUS[0]}
if [ "$e2e" -eq 0 ]; then conclusion=success; else conclusion=failure; fi
rc=$e2e

if [ "${EVENT_NAME:-}" = pull_request ]; then
  if [ "$e2e" -eq 0 ]; then
    node scripts/served-reach.mjs --rendered "$AFTERSIGN_RENDERED_OUT" --mode fail 2>&1 | tee "$rendered_log"
    rendered=${PIPESTATUS[0]}
    [ "$rendered" -ne 0 ] && rc=$rendered
  fi
  node scripts/pr-ci-evidence.mjs --e2e "$conclusion" --results aftersign/playwright-report/results.json \
    --rendered "$rendered_log" --served-result "${SERVED_RESULT:-}" --served-counts "${SERVED_COUNTS:-}" --served-exempt "${SERVED_EXEMPT:-}" \
    || echo "::warning::CI evidence block not written (report only)"
fi

if [ "$e2e" -ne 0 ]; then
  summary=$(mktemp)
  node scripts/ci/aftersign-failure-summary.mjs "$runner_log" aftersign/playwright-report/results.json > "$summary" \
    || printf '%s\n\n%s\n' '## aftersign WebGL e2e — failure summary' '(no failure context captured; see run logs)' > "$summary"
  tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}" < "$summary"
  if [ "${EVENT_NAME:-}" = pull_request ] && [ -n "${PR_NUMBER:-}" ]; then
    head -c 60000 "$summary" > "$summary.body"
    gh pr comment "$PR_NUMBER" --body-file "$summary.body" || echo "::warning::failure summary not commented on the PR"
  fi
fi

exit "$rc"
