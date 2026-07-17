# Packet-intent consolidation — dead-fork removal (meta-moderator cycle, chunk 2)

## What changed

Deleted two dead TypeScript forks of the packet-intent contract, plus their
colocated tests:

- `apps/web/src/aftersign/packetIntent.ts` (fork with `HOLD_TO_OPEN_MS` = 320ms)
- `apps/web/src/aftersign/packetIntent.test.ts`
- `packages/aftersign/src/packetIntent.ts` (fork with `HOLD_TO_OPEN_MS` = 520ms)
- `packages/aftersign/src/packetIntent.test.ts`

## Why

The repo carried three drifted copies of one interaction contract with three
different hold-to-open thresholds. Only one is live:

- **Live:** `aftersign/packet-intent.js` — 450ms, wired via `index.html` (line ~163).
- **Dead:** the two TS forks above. A repo-wide import scan confirmed the only
  importers of either fork were their own colocated test files — zero
  production consumers.

Divergent constants in dead code are a landmine: anyone greping
`HOLD_TO_OPEN_MS` would find three conflicting values and no signal for which
one the product actually uses.

## Single source of truth

`aftersign/packet-intent.js` (450ms) is now the only copy. Any future port to
TypeScript should MOVE this file's behavior (450ms threshold), not resurrect
either deleted fork's constants.

Note: `apps/web/src/aftersign/packetIntentPressureFeel.ts` is a separate,
still-live module (pressure-based decision feel) and was intentionally left
untouched.
