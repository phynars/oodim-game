#!/usr/bin/env bash
# The AFTERSIGN WebGL e2e and the checks that read its output (was inline in
# .github/workflows/ci.yml; moved 11-09 when the game's workflows became
# rendered from the oodim repo profile, which runs plain shell steps only).
#
# The e2e runs as parallel shards (11-11: one job had grown to 25–40 min).
# Each shard job calls `run`; the job after them calls `report` once.
#
#   run <e2e command...>   one shard:
#     1. pick the specs this PR has to run (scripts/ci/aftersign-e2e-select.mjs:
#        the full suite unless only docs, specs or test helpers changed);
#     2. run this shard's slice of them, tee'd so the failure summary can
#        quote the raw log (#1065);
#     3. leave the log, the JSON report, the rendered-text record and the exit
#        code in ci-artifacts/ for `report`.
#
#   report                 after every shard, with their artifacts in ./shards/:
#     1. merge the shards' JSON reports, logs and rendered-text records;
#     2. on a PR with a green e2e: the rendered-text rule (blocking since
#        11-01, game #2511/#2529): every new player-facing string must be
#        SHOWN in a served playtest, reached through real input;
#     3. on a PR: the CI-evidence block in the PR body (report only);
#     4. on a red e2e: the failure summary to the run page, and on a PR as a
#        PR comment (agents can't read run logs).
#
# usage: bash scripts/ci/aftersign-e2e.sh run npm run test:e2e:aftersign
#        bash scripts/ci/aftersign-e2e.sh report
# (the e2e command is an argument so ci.yml names it, which
# scripts/check-product-wiring.mjs reads).
# Env from the workflow: EVENT_NAME, PR_NUMBER, GITHUB_TOKEN, GH_TOKEN,
# GATE_EXEMPT_APPROVERS, SERVED_RESULT, SERVED_COUNTS, SERVED_EXEMPT;
# `run` also reads SHARD_INDEX and SHARD_TOTAL (unset = one unsharded run).
set -uo pipefail

usage() {
  echo "usage: $0 run <e2e command...> | report" >&2
  exit 2
}

run_shard() {
  [ "$#" -gt 0 ] || usage
  mkdir -p ci-artifacts
  # Turns on the rendered-text recorder in the test build only
  # (aftersign/vite.config.ts); the deploy never sets it.
  export AFTERSIGN_RENDERED_OUT="$PWD/ci-artifacts/aftersign-rendered.jsonl"
  local runner_log=ci-artifacts/aftersign-e2e-runner.log
  local specs_file selection mode reason e2e
  specs_file=$(mktemp)

  selection=$(node scripts/ci/aftersign-e2e-select.mjs --out "$specs_file") || selection="mode=all"
  mode=$(sed -n 's/^mode=//p' <<<"$selection" | tail -1)
  reason=$(sed -n 's/^reason=//p' <<<"$selection" | tail -1)
  case "$mode" in
    all | some | none) ;;
    *)
      mode=all
      reason="the selection printed no mode"
      ;;
  esac
  printf '%s\n' "aftersign e2e specs: $mode ($reason)" | tee ci-artifacts/e2e-selection.txt
  echo "$mode" > ci-artifacts/e2e-mode
  echo "${SHARD_TOTAL:-1}" > ci-artifacts/shard-total

  local args=()
  if [ -n "${SHARD_INDEX:-}" ] && [ -n "${SHARD_TOTAL:-}" ]; then
    args+=("--shard=$SHARD_INDEX/$SHARD_TOTAL")
  fi
  if [ "$mode" = some ]; then
    # A selected spec may sit in another shard, or in the pure lane's list.
    args+=(--pass-with-no-tests)
    while IFS= read -r spec; do
      [ -n "$spec" ] && args+=("$spec")
    done < "$specs_file"
    cat "$specs_file"
  fi

  if [ "$mode" = none ]; then
    echo "no e2e spec can be affected by this PR's files: the e2e is not run" | tee "$runner_log"
    e2e=0
  else
    "$@" -- ${args[@]+"${args[@]}"} 2>&1 | tee "$runner_log"
    e2e=${PIPESTATUS[0]}
    # Copied now: a later step in the job (the red/green lanes) reruns
    # Playwright and overwrites the report.
    cp aftersign/playwright-report/results.json ci-artifacts/results.json 2>/dev/null || true
  fi
  echo "$e2e" > ci-artifacts/e2e-exit
  exit "$e2e"
}

report() {
  mkdir -p ci-artifacts aftersign/playwright-report
  export AFTERSIGN_RENDERED_OUT="$PWD/ci-artifacts/aftersign-rendered.jsonl"
  local runner_log=/tmp/aftersign-e2e-runner.log
  local rendered_log=/tmp/rendered-reach.log
  local results=aftersign/playwright-report/results.json
  : > "$runner_log"
  : > "$AFTERSIGN_RENDERED_OUT"
  rm -f "$results"

  # Each shard's artifact is a directory under ./shards/. Files are found by
  # name so the layout inside an artifact does not matter.
  local dir f code reported=0 expected=0 failed=0 mode=all selection=""
  local reports=()
  for dir in shards/*/; do
    [ -d "$dir" ] || continue
    f=$(find "$dir" -name e2e-exit -type f | head -1)
    [ -n "$f" ] || continue
    reported=$((reported + 1))
    code=$(tr -d '[:space:]' < "$f")
    [ "$code" = 0 ] || failed=$((failed + 1))
    f=$(find "$dir" -name shard-total -type f | head -1)
    [ -n "$f" ] && expected=$(tr -d '[:space:]' < "$f")
    f=$(find "$dir" -name e2e-mode -type f | head -1)
    [ -n "$f" ] && mode=$(tr -d '[:space:]' < "$f")
    f=$(find "$dir" -name e2e-selection.txt -type f | head -1)
    [ -n "$f" ] && selection=$(head -1 "$f")
    f=$(find "$dir" -name aftersign-e2e-runner.log -type f | head -1)
    if [ -n "$f" ]; then
      printf '===== %s =====\n' "$(basename "$dir")" >> "$runner_log"
      cat "$f" >> "$runner_log"
    fi
    f=$(find "$dir" -name aftersign-rendered.jsonl -type f | head -1)
    [ -n "$f" ] && cat "$f" >> "$AFTERSIGN_RENDERED_OUT"
    f=$(find "$dir" -path '*ci-artifacts/results.json' -type f | head -1)
    [ -n "$f" ] && reports+=("$f")
  done
  node scripts/ci/aftersign-e2e-merge.mjs "$results" ${reports[@]+"${reports[@]}"}

  # A shard that never reached the e2e (install or build died) left no exit
  # code: the run is not green without every shard's.
  local e2e=0
  if [ "$failed" -gt 0 ] || [ "$reported" -eq 0 ] || [ "$reported" -lt "$expected" ]; then e2e=1; fi
  echo "aftersign e2e: $reported of $expected shard(s) reported, $failed failed; ${selection:-aftersign e2e specs: unknown}"
  echo "${selection:-aftersign e2e specs: unknown}" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

  local conclusion rc=$e2e rendered
  if [ "$e2e" -ne 0 ]; then
    conclusion=failure
  elif [ "$mode" = none ]; then
    conclusion="not run (this PR's files reach no e2e spec)"
  elif [ "$mode" = some ]; then
    conclusion="success (only the specs this PR's files can affect)"
  else
    conclusion=success
  fi

  if [ "${EVENT_NAME:-}" = pull_request ]; then
    if [ "$e2e" -eq 0 ]; then
      node scripts/served-reach.mjs --rendered "$AFTERSIGN_RENDERED_OUT" --mode fail 2>&1 | tee "$rendered_log"
      rendered=${PIPESTATUS[0]}
      [ "$rendered" -ne 0 ] && rc=$rendered
    fi
    node scripts/pr-ci-evidence.mjs --e2e "$conclusion" --results "$results" \
      --rendered "$rendered_log" --served-result "${SERVED_RESULT:-}" --served-counts "${SERVED_COUNTS:-}" --served-exempt "${SERVED_EXEMPT:-}" \
      || echo "::warning::CI evidence block not written (report only)"
  fi

  if [ "$e2e" -ne 0 ]; then
    local summary
    summary=$(mktemp)
    node scripts/ci/aftersign-failure-summary.mjs "$runner_log" "$results" > "$summary" \
      || printf '%s\n\n%s\n' '## aftersign WebGL e2e — failure summary' '(no failure context captured; see run logs)' > "$summary"
    tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}" < "$summary"
    if [ "${EVENT_NAME:-}" = pull_request ] && [ -n "${PR_NUMBER:-}" ]; then
      head -c 60000 "$summary" > "$summary.body"
      gh pr comment "$PR_NUMBER" --body-file "$summary.body" || echo "::warning::failure summary not commented on the PR"
    fi
  fi

  exit "$rc"
}

case "${1:-}" in
  run)
    shift
    run_shard "$@"
    ;;
  report)
    report
    ;;
  *)
    usage
    ;;
esac
