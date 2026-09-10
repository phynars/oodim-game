# Handoff: packet-action-feel parallel-contract rejection (Refs #1694)

PR #1694 revision **deletes** `aftersign/packet-action-feel.js` +
`aftersign/packet-action-feel.test.js`. Soren's REQUEST_CHANGES review
was correct on every axis, and — more importantly — the module was a
parallel-vocabulary reimplementation of the SHIPPED packet-intent
contract that's already wired into `aftersign/main.js`. This is the
same rejection pattern documented in `HANDOFF-1535.md`.

## Why deletion, not wire-up

Soren flagged three orphan axes:

1. Zero consumers under `apps/web/src/aftersign/`.
2. No CI lane runs the test (`pure-runner.ts`, `playwright.pure.config.ts`
   testMatch, and the vitest `include` list all skip it).
3. The `aftersign/tsconfig.json` `include: ["src"]` — plus no `allowJs`
   — leaves the repo-root `.js` file outside the blocking
   `typecheck:aftersign` gate.

Wiring it in would have fixed those three axes but introduced a worse
problem: a SECOND contract for the same interaction. The shipped
contract is `aftersign/src/packetIntent.ts`, which already models:

| Concern                             | packet-action-feel.js         | packetIntent.ts (shipped)                    |
|-------------------------------------|-------------------------------|----------------------------------------------|
| Quick tap → non-destructive outcome | `preview-packet` (invented)   | `SEALED` (`PACKET_OUTCOME.SEALED`)           |
| Deliberate long press → commit      | `open-packet` (hold-only)     | `OPENED` (hold **plus** seal pull ≥ 10px)    |
| Drift beyond cancel radius          | `cancelled` (18px, invented)  | `CANCELLED` (`DRIFT_CANCEL_PX = 14`)         |
| Explicit "keep sealed"              | `chooseKeepSealed()` (extra)  | Short-tap release IS the keep-sealed path    |
| Focus-loss safety                   | (absent)                      | `hiddenAtMs` / `consumeHiddenInterval` (#714)|
| Sticky-cancel invariant             | (absent)                      | Pinned by `checkStickyCancelCannotBeResurrectedByTick` |
| Boundary asymmetry (>, ≥)           | (absent)                      | Pinned by `checkPullBoundaryAsymmetryHolds`  |

The shipped contract is deeper (focus-loss, sticky-cancel, boundary
asymmetry), already renders through `aftersign/main.js`, and is pinned
by `runPacketIntentChecks` in `aftersign/pure-runner.ts` + the pure
Playwright lane's `packet-intent-contract.spec.ts`. Adding a second
model with divergent numbers (420/180/18 vs. 450/180/14) would create
two sources of truth and drift them apart on the next revision.

## Preserved intent (for a future PR to consider)

The one distinction the deleted module drew that `packetIntent.ts` does
NOT already draw at the primitive level:

> A quick tap should **preview** the packet (open a summary), separate
> from **preserve** (keep sealed and move on) and **open** (commit the
> story fork).

`packetIntent.ts` folds preview into SEALED — short tap keeps the seal,
period. The three-way summary/preserve/open split lives one layer up
in `resolvePacketIntent` (`preserve | open | inspect`) and
`evaluatePacketIntent` (`preserve | open | cancel`). "Inspect" is the
closest existing kin to "preview".

If we want an EXPLICIT "preview" state at the shipped-controller level
(distinct from SEALED), the correct path is:

1. Extend `PacketIntentSnapshot.outcome` with a new
   `PACKET_OUTCOME.PREVIEWED` value (or a peer field), keeping
   OPENED/SEALED/CANCELLED as-is.
2. Update `runPacketIntentChecks` in `aftersign/src/packetIntent.ts`
   to pin when PREVIEWED is emitted (e.g. short tap under some
   `PREVIEW_MAX_MS`) vs. SEALED (deliberate hold, no pull, released).
3. Update `apps/web/src/aftersign/packetChoiceFeel.ts` and the
   `#packetChoice` render site to distinguish the two.
4. Add a consumer test under `apps/web/src/aftersign/` (jsdom / vitest)
   that proves the served surface actually renders the new state.

None of that lands in this PR — this PR is strictly the deletion.

## What this PR does

- Deletes `aftersign/packet-action-feel.js`
- Deletes `aftersign/packet-action-feel.test.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1694.md`

## What this PR does NOT do

- Does NOT modify `packetIntent.ts`, `packetChoiceFeel.ts`, or any
  shipped surface.
- Does NOT add a `PREVIEWED` outcome — that's a real design question
  that deserves its own scoped PR anchored on the shipped contract.

Refs #1694
