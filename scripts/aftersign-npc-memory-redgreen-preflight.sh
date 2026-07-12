#!/usr/bin/env bash
# Preflight for the aftersign-npc-memory-redgreen red-polarity CI lane (#622).
#
# Decides whether the red lane (FLAGSHIP_BREAK_MODE=drop-memory MUST fail)
# can run yet, and emits `retired=true|false` to $GITHUB_OUTPUT (falls back
# to stdout for local runs).
#
# Detection is keyed off STRUCTURED signals, never the human-readable test
# title. Title-grep coupling was the bug #622 fixes: a harmless test rename
# could silently flip retirement behavior. The signals, in priority order:
#
#   1. Conditional guard present — a skip keyed off
#      process.env.FLAGSHIP_BREAK_MODE !== "drop-memory"
#      -> retired=false (red lane runs). Checked FIRST so a stale leftover
#      sentinel can never suppress a live red lane.
#
#   2. Retirement sentinel present in the spec —
#      // redgreen-sentinel: npc-memory-drop-memory-guard-pending
#      -> retired=true (Phase 3 / #566 pending). The sentinel is deleted by
#      the author in the same change that introduces the conditional guard.
#
#   3. A test.skip(...) exists but the drop-memory guard is missing/altered
#      and the sentinel is absent -> hard error: the lane can no longer
#      verify itself. Update this script if the guard intentionally changed.
#
#   4. Neither guard nor sentinel -> the npc-memory contract is fully live
#      in the main suite -> retired=true.
#
# Consumed by .github/workflows/aftersign-npc-memory-redgreen.yml
# (red-polarity preflight step: `bash scripts/aftersign-npc-memory-redgreen-preflight.sh`).
set -euo pipefail

spec="aftersign/e2e/flagship-surface-contract.spec.ts"
sentinel="redgreen-sentinel: npc-memory-drop-memory-guard-pending"
out="${GITHUB_OUTPUT:-/dev/stdout}"

if [ ! -f "$spec" ]; then
  echo "::error::Spec file '$spec' not found — update scripts/aftersign-npc-memory-redgreen-preflight.sh if it moved."
  exit 1
fi

if grep -Pzo '(?s)test\.skip\(\s*process\.env\.FLAGSHIP_BREAK_MODE\s*!==\s*"drop-memory"' "$spec" > /dev/null; then
  echo "conditional drop-memory guard present — red polarity will run."
  echo "retired=false" >> "$out"
elif grep -qF "$sentinel" "$spec"; then
  echo "retirement sentinel present (Phase 3 / #566 pending) — red polarity retired until the spec exposes a conditional guard."
  echo "retired=true" >> "$out"
elif grep -q 'test\.skip(' "$spec"; then
  echo "::error::Spec calls test.skip(...) but the FLAGSHIP_BREAK_MODE=drop-memory guard is missing or altered, and the retirement sentinel is absent. The red-polarity lane cannot verify itself — update scripts/aftersign-npc-memory-redgreen-preflight.sh if this change was intentional."
  exit 1
else
  echo "npc-memory contract is fully live in the main suite — red polarity retired."
  echo "retired=true" >> "$out"
fi
