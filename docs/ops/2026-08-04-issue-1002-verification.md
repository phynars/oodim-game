# Ops note: #1002 closed as already-satisfied (2026-08-04)

## Verdict

Issue #1002 ("Wire Io returning-session lines into the served scene") was
closed WITHOUT a code change this cycle because the requested wiring
already exists on main. Re-implementing it would have duplicated the
returning-session boot-line logic in `aftersign/main.js`.

## Evidence (verified at commit 7064665)

- `aftersign/main.js` imports the canonical selector:
  `import { chooseIoReturningSessionLine } from "../packages/aftersign/src/ioReturningSession"`.
- At boot, when `stored?.packet?.delivered` is true, `main.js` computes
  `ioReturningBootLine` from the persisted delivery-outcome memory fact
  (`packetOutcome: outcomeFact.object`) plus route attention
  (`secondActionFromMemory` → listened/skipped). A delivered save with
  no delivery-outcome fact falls back to
  `chooseIoReturningSessionLine({})` → the bare-return line.
- `lineForBeat()` serves `ioReturningBootLine` while the scene remains
  at the persisted boot beat, so a returning-session player actually
  hears the line; sealed vs. opened outcomes are distinct via the
  package selector's `sealedPacket*` / `openedPacket*` branches.
- Landed via PR #985 (issue #957, 2026-08-02) and advanced by #1016
  (2026-08-04), per `git log` on `aftersign/main.js`.

This meets all three acceptance criteria of #1002 (outcome-matched line,
bare-return fallback, served-surface consumption per #954's CONSUMER
RULE).

## Module disambiguation (the trap that nearly caused a duplicate wire)

There are TWO Io returning-line modules in this repo:

| Module | Location | Status |
| --- | --- | --- |
| `chooseIoReturningSessionLine` / `IO_BARE_RETURN_LINE` | `packages/aftersign/src/ioReturningSession.ts` | Canonical; consumed by `aftersign/main.js` (this is #1002's scope) |
| `chooseAftersignIoReturningLine` | `apps/web/src/aftersign/ioReturningDialogue.ts` | Test-side selector; no runtime consumer (only its own test imports it) |

A prior triage chunk confirmed the apps/web selector is unconsumed and
concluded #1002 was unimplemented — but that selector is NOT the module
#1002 references. Any future session touching returning-session lines
must check WHICH of the two modules an issue names before wiring.

## Follow-up candidate (deliberately not filed this cycle)

`apps/web/src/aftersign/ioReturningDialogue.ts` duplicates the package
selector's job with no runtime consumer. It is a dedupe/refactor
candidate, left unfiled to keep this cycle to one coherent change and
to avoid colliding with the #954 epic's sibling stories (#956, #958,
#957 done-gate).

Refs #1002.
