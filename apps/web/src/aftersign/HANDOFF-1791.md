# Handoff: packetIntentFeel parallel-contract rejection, take 3 (Refs #1791)

PR #1791 revision **deletes** `packages/aftersign/src/packetIntentFeel.ts`
and `packages/aftersign/src/packetIntentFeel.test.ts`. This is the
THIRD repetition of the parallel-contract anti-pattern already
documented in `HANDOFF-1535.md`, `HANDOFF-1694.md`, and
`HANDOFF-1698.md`. Read those first — this note only records what was
specific to #1791 and why deletion (not revision on this branch) is
still the right move.

## What #1791 shipped and why it was rejected

Two new files under `packages/aftersign/src/`:

- `packetIntentFeel.ts` — a fresh `resolvePacketIntent` /
  `applyPacketIntent` pair with thresholds `PACKET_OPEN_HOLD_MIN_MS =
  520`, `PACKET_OPEN_MAX_TRAVEL_PX = 14`, and no pull-min at all.
- `packetIntentFeel.test.ts` — a self-test importing only from that
  new file.

The same three defects HANDOFF-1698 called out are all present again:

1. **Zero consumers.** A repo-wide grep for `packetIntentFeel` returns
   only these two new files. Nothing shipped wires
   `applyPacketIntent` / `resolvePacketIntent` into the aftersign
   surface.
2. **Weaker invariant than the shipped contract.** The shipped
   `packetIntent.ts` gates OPEN on TWO axes (`heldMs >=
   HOLD_TO_OPEN_MS && pullPx >= OPEN_PULL_MIN_PX`) and returns SEALED
   for a stationary hold. `packetIntentFeel.resolvePacketIntent`
   returns `"open"` for the same input — a direct disagreement on the
   central invariant that `checkStationaryHoldOpensPacket` pins.
   Missing entirely: pull-min, sticky-cancel invariant, focus-loss
   safety (`hiddenAtMs` / `consumeHiddenInterval`).
3. **CI won't catch it.** No `runPacketIntentFeelChecks` entry in
   `aftersign/pure-runner.ts`; the pure Playwright lane's `testDir`
   doesn't cover `packages/aftersign/src/`. The self-test can only
   run under an ad-hoc `node --experimental-strip-types` invocation
   that's not gated by any lane.

## Why deletion instead of "extend the shipped contract on this PR"

The reviewer feedback correctly points at the shipped module
(`aftersign/src/packetIntent.ts`) as where a `PREVIEWED` outcome or
richer "preserve" state would need to land. That work is a separate,
scoped PR — it touches `runPacketIntentChecks`, `packetChoiceFeel.ts`,
and the `#packetChoice` render site, and it wants its own review
against the shipped invariants (boundary asymmetry, sticky-cancel,
focus-loss). Grafting it onto this branch would either (a) ship
something half-wired and untested against the pure-runner or (b) fold
the two-file self-test into a much larger diff whose review scope has
already been rejected. Same reasoning HANDOFF-1698 used.

## What this PR now does

- Deletes `packages/aftersign/src/packetIntentFeel.ts`
- Deletes `packages/aftersign/src/packetIntentFeel.test.ts`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1791.md`

## What this PR does NOT do

- Does NOT modify `packetIntent.ts`, `packetChoiceFeel.ts`, or any
  shipped aftersign surface.
- Does NOT add a `PREVIEWED` outcome or any new packet-state — that
  belongs in a fresh PR anchored on the shipped contract, with the
  `pure-runner` wiring and jsdom consumer test called out in
  HANDOFF-1698's "correct next step" section.

## For the next agent who considers landing a fourth copy

Before you write a new `packet*Feel.ts` under any package:

1. `grep -R "runPacketIntentChecks\|HOLD_TO_OPEN_MS" packages/ apps/` —
   find the shipped contract, read its assertions, and confirm your
   proposed threshold is compatible with `checkStationaryHoldOpensPacket`
   and the pull-min gate.
2. If your model disagrees on the OPEN gate (single-axis vs two-axis),
   STOP — you're rebuilding the rejected module.
3. If you need a new state (PREVIEWED, INSPECTED, etc.), extend
   `PACKET_OUTCOME` in `aftersign/src/packetIntent.ts`, add a matching
   `check*` in `runPacketIntentChecks`, wire it into `packetChoiceFeel`,
   and add a jsdom consumer test. That's the pattern that ships.

Refs #1791
