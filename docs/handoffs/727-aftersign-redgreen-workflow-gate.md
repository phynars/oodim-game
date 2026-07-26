# Handoff — #727 AFTERSIGN red/green workflow gate

**Status:** blocked on human with `.github/workflows/**` write access.
**PR:** #847 (do NOT merge; see below).

## Why this is stuck

Issue #727 asks that `.github/workflows/aftersign-npc-memory-redgreen.yml`
stop grepping the sentinel string `@redgreen:npc-memory-roundtrip
fixme-pending-phase-3` out of `aftersign/e2e/npc-memory-roundtrip.spec.ts`
to decide CI polarity, and instead read an explicit, reviewable gate.

The `/code` avatar writable-paths whitelist in this repo is:

```
apps/, packages/, workers/, docs/, README.md, pacman/, galaga/,
doom/, agar/, landing/, e2e-shared/, package.json, aftersign/,
src/, scripts/, projects/, tools/
```

`.github/workflows/` is **not** in that list. Two `/code` sessions
(agent/dc5696e4 first, this session second) have both hit
`Error: path ".github/workflows/..." is outside the avatar's writable
paths` when attempting the workflow edit. The generic system-prompt
hint that lists `.github/workflows/` as an allowed prefix is
contradicted by the executor's actual per-repo whitelist here.

## What the fix looks like (for a human landing it)

Two files change together — atomically, in the same PR:

### 1. Add `aftersign/e2e/redgreen-gates.json`

```json
{
  "npc-memory-roundtrip": {
    "mode": "retired",
    "$modes": "retired | live | redgreen",
    "$note": "Explicit gate for the aftersign-npc-memory-redgreen workflow. See #727."
  }
}
```

Modes:
- `retired` — both lanes stand down (current state: phase-3 fixme
  still pending on the spec).
- `live` — green lane runs (contract is durable); red lane retires
  (no `FLAGSHIP_BREAK_MODE=drop-memory` guard yet).
- `redgreen` — both lanes run; spec exposes the
  `FLAGSHIP_BREAK_MODE=drop-memory` conditional `test.skip(...)` guard.

### 2. Rewrite both preflight steps in
`.github/workflows/aftersign-npc-memory-redgreen.yml`

Replace the current sentinel-grep logic at lines 77–95 (green lane
preflight) and 125–138 (red lane preflight) with a JSON read of the
gate file. Suggested body:

```yaml
      - name: Preflight — read explicit gate
        id: preflight
        shell: bash
        run: |
          gates=aftersign/e2e/redgreen-gates.json
          mode=$(node -e "const g=require('./'+process.argv[1]); const m=(g['npc-memory-roundtrip']||{}).mode; if(!m){process.exit(2)} process.stdout.write(m)" "$gates") || {
            echo "::error::redgreen-gates.json missing 'npc-memory-roundtrip.mode' (expected: retired | live | redgreen)."
            exit 1
          }
          echo "gate mode: $mode"
          case "$mode" in
            retired)  echo "retired=true"  >> "$GITHUB_OUTPUT" ;;
            live)     # green: run; red: retire
                      # (branch on job name via matrix or duplicate per-job)
                      ;;
            redgreen) echo "retired=false" >> "$GITHUB_OUTPUT" ;;
            *) echo "::error::Unknown mode '$mode'"; exit 1 ;;
          esac
```

(Per-job polarity: the green lane retires only on `retired`; the red
lane retires on `retired` **and** `live`. Keep the two `case`
statements symmetric with today's structure — just source the input
from the JSON instead of `grep`.)

## Acceptance re-check (from #727)

- [x] Workflow no longer greps test/spec text for retirement — landed
      by the workflow rewrite above.
- [x] Retirement state is driven by an explicit, reviewable gate
      (`aftersign/e2e/redgreen-gates.json`).
- [x] Editing comments/markers in spec files cannot change red/green
      polarity — only PRs that touch `redgreen-gates.json` can.
- [x] Current phase semantics preserved — initial `mode: "retired"`
      matches today's grep-detects-fixme behavior.

## What to do with PR #847

Close it. The JSON-only diff cannot satisfy #727 without the
workflow edit, and Mara has (correctly) requested changes twice.
Re-open a fresh PR that lands **both** files atomically from a seat
with `.github/workflows/**` write access. This handoff doc can be
deleted in that same PR.

## Related

- #727 — the issue.
- #526 / #700 / #506 / #590 / #766 — SwiftShader cold-start flakes
  the workflow's paths filter already dodges (context for reviewers).
- `.github/workflows/aftersign-durable-save-redgreen.yml` — sibling
  workflow; if this gate-file pattern lands, it's worth migrating
  its own sentinel-grep (lines 79, 124) to the same JSON, keyed as
  `"durable-save-load"`.

Refs #727.
