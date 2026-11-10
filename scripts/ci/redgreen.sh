#!/usr/bin/env bash
# Red/green polarity lanes (was .github/workflows/redgreen.yml, 9 jobs; moved
# 11-09 into the aftersign and agar CI jobs, which already have the install,
# build and browser). A green lane must pass; a red lane runs a spec under a
# break mode and MUST fail, proving the spec can catch that break.
#
#   redgreen.sh markers    @redgreen fixme-pending-phase-3 markers carry
#                          unexpired `expires=YYYY-MM-DD owner=<name>` metadata
#   redgreen.sh aftersign  the lanes aftersign/redgreen.config.json marks live
#                          (THE source of truth, #1071/#727: 'live' runs,
#                          'retired' skips with a log line)
#   redgreen.sh agar       the frozen agar multiplayer + persistence lanes
#
# Every lane runs even when an earlier one fails; the exit code is 1 if any did.
set -euo pipefail

cfg=aftersign/redgreen.config.json
fail=0

lane_state() { node -p "JSON.parse(require('fs').readFileSync('$cfg', 'utf8'))['$1']['$2']"; }

# must_fail <label> <command...>: a red lane. Passing is the failure.
must_fail() {
  local label=$1
  shift
  set +e
  "$@"
  local status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    echo "::error::$label: the broken-polarity spec PASSED (exit 0), so the guard did not catch its break mode."
    return 1
  fi
  echo "$label: the broken-polarity spec failed as expected (exit $status); the guard is honest."
}

# guard_present <spec> <perl regex> <label>: a live red lane whose spec lost
# its break-mode guard can't verify itself (fail loud, don't skip).
guard_present() {
  if ! grep -Pzo "$2" "$1" > /dev/null; then
    echo "::error::$cfg marks $3 LIVE but its break-mode guard is missing from $1, so the lane cannot verify itself. Fix the spec or flip the config in the same PR."
    return 1
  fi
}

run() { # run <label> <command...>: a lane; records a failure and goes on
  local label=$1
  shift
  echo "::group::$label"
  "$@" || { echo "::error::$label failed"; fail=1; }
  echo "::endgroup::"
}

markers() {
  local today hit file rest line text expiry bad=0
  today=$(date -u +%Y-%m-%d)
  while IFS= read -r hit; do
    file=${hit%%:*}
    rest=${hit#*:}
    line=${rest%%:*}
    text=${rest#*:}
    if ! grep -qE 'expires=[0-9]{4}-[0-9]{2}-[0-9]{2} owner=[A-Za-z0-9._-]+' <<<"$text"; then
      echo "::error file=$file,line=$line::fixme-pending-phase-3 marker is missing 'expires=YYYY-MM-DD owner=<name>' metadata"
      bad=1
      continue
    fi
    expiry=$(sed -nE 's/.*expires=([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/p' <<<"$text")
    if [[ "$expiry" < "$today" ]]; then
      echo "::error file=$file,line=$line::fixme-pending-phase-3 marker expired on $expiry (today is $today) — remove the marker or renew the expiry"
      bad=1
    fi
  done < <(grep -rnE '^[[:space:]]*// @redgreen:[a-z-]+ fixme-pending-phase-3' aftersign/ || true)
  return "$bad"
}

# Explicit `|| return 1`: these run under `run`'s `||`, where bash ignores set -e.
durable_red() {
  guard_present aftersign/e2e/save-load-durable-contract.spec.ts '(?s)process\.env\.FLAGSHIP_BREAK_MODE\s*!==\s*"local-only-save"' durable-save.red || return 1
  must_fail "durable-save red" npm run test:e2e:aftersign:durable-save:broken-local-only
}

npc_red() {
  guard_present aftersign/e2e/npc-memory-roundtrip.spec.ts '(?s)test\.skip\(\s*process\.env\.FLAGSHIP_BREAK_MODE\s*!==\s*"drop-memory"' npc-memory.red || return 1
  (export FLAGSHIP_BREAK_MODE=drop-memory; must_fail "npc-memory red" npm run test:e2e:aftersign:npc-memory)
}

# A red persistence lane is enforced only once its test is live (not test.skip).
skipped_in_spec() { grep -A 3 "test(\s*\"$1" agar/e2e/persistence-harness.spec.ts | grep -q 'test\.skip('; }

case "${1:-}" in
  markers)
    markers
    ;;
  aftersign)
    for spec in durable-save npc-memory; do
      for polarity in green red; do
        state=$(lane_state "$spec" "$polarity")
        echo "$spec $polarity lane: $state ($cfg)"
        [ "$state" = live ] || continue
        case "$spec/$polarity" in
          durable-save/green) run "durable-save green" npm run test:e2e:aftersign:durable-save ;;
          durable-save/red) run "durable-save red" durable_red ;;
          npc-memory/green) run "npc-memory green" npm run test:e2e:aftersign:npc-memory ;;
          npc-memory/red) run "npc-memory red" npc_red ;;
        esac
      done
    done
    ;;
  agar)
    run "agar multiplayer red (drop-every-7th)" must_fail "agar multiplayer red" npm run test:e2e:agar:broken
    run "agar persistence green" npm run test:e2e:agar:persistence
    if skipped_in_spec monotonic-persist; then
      echo "monotonic-persist is still skipped; red polarity not enforced this run."
    else
      run "agar persistence red (non-monotone-persist)" must_fail "monotonic-persist red" npm run test:e2e:agar:persistence:broken-non-monotone
    fi
    if skipped_in_spec eviction-roundtrip; then
      echo "eviction-roundtrip is skipped; red polarity not enforced this run."
    else
      run "agar persistence red (lossy-persist)" must_fail "eviction-roundtrip red" npm run test:e2e:agar:persistence:broken-lossy
    fi
    ;;
  *)
    echo "usage: $0 markers|aftersign|agar" >&2
    exit 2
    ;;
esac

exit "$fail"
