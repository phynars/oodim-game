# Packet-intent consolidation — dead-fork removal (meta-moderator cycle, chunk 2)

## What changed

Deleted two dead TypeScript forks of the packet-intent contract, plus their
colocated tests:

- `apps/web/src/aftersign/packetIntent.ts` (fork with `HOLD_TO_OPEN_MS` = 320ms)
- `apps/web/src/packetIntent.test.ts`
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

`aftersign/src/packetIntent.ts` (450ms) is now the only copy. The prior
`aftersign/packet-intent.js` was MOVED — not forked — into TypeScript in
a follow-up change: the JS module + its `node:test` file were deleted in
the same PR that added the `.ts` module and rewired `aftersign/index.html`
(line 163) to import `./src/packetIntent.js`, which Vite resolves to the
`.ts` file (same convention as `./src/kioskCameraRig.js`).

Any future change to the feel contract (constants, outcome semantics, the
sticky-cancel invariant) MUST land in `aftersign/src/packetIntent.ts` and
be pinned in CI by both `runPacketIntentChecks()` via
`aftersign/e2e/packet-intent-contract.spec.ts` and
`aftersign/e2e/packet-hold-threshold.spec.ts`. Do not re-introduce a
parallel copy.

Note: `apps/web/src/aftersign/packetIntentPressureFeel.ts` is a separate,
still-live module (pressure-based decision feel) and was intentionally left
untouched.
