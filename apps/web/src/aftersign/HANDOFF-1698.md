# Handoff: packetIntentFeel parallel-contract rejection (Refs #1698)

PR #1698 revision **deletes** `apps/web/src/aftersign/packetIntentFeel.ts`
+ `apps/web/src/aftersign/packetIntentFeel.test.ts`. Soren's
REQUEST_CHANGES review was correct on every axis, and this is the
SECOND repetition of the parallel-contract pattern that
`HANDOFF-1694.md` already documents (and `HANDOFF-1535.md` before it).
Read those two handoffs first — this note only records what was
specific to #1698.

## Why deletion, not revision

The shipped packet-intent contract is `aftersign/src/packetIntent.ts`,
pinned by `runPacketIntentChecks` in `aftersign/pure-runner.ts` and the
pure Playwright lane's `packet-intent-contract.spec.ts`. It is
rendered through `aftersign/main.js`.

`packetIntentFeel.ts` re-modeled the same interaction with different
numbers and a WEAKER invariant:

| Concern                           | packetIntentFeel.ts (rejected) | packetIntent.ts (shipped)                            |
|-----------------------------------|--------------------------------|------------------------------------------------------|
| Hold-to-open threshold            | `holdToOpenMs: 520`            | `HOLD_TO_OPEN_MS: 450`                               |
| Minimum seal-pull to commit OPEN  | (absent)                       | `OPEN_PULL_MIN_PX: 10` — REQUIRED for OPEN           |
| Drift cancel radius               | `moveCancelPx: 14`             | `DRIFT_CANCEL_PX: 14`                                |
| Stationary hold outcome           | `decision: "open"` (WRONG)     | `PACKET_OUTCOME.SEALED` — no pull, no open           |
| Boundary asymmetry (>, ≥)         | (absent)                       | Pinned by `checkPullBoundaryAsymmetryHolds`          |
| Sticky-cancel invariant           | (absent)                       | Pinned by `checkStickyCancelCannotBeResurrectedByTick` |
| Focus-loss safety                 | (absent)                       | `hiddenAtMs` / `consumeHiddenInterval` (#714)        |

The single most damning axis is `checkStationaryHoldOpensPacket`. That
assertion says a hold with `hypot(1, 1) ≈ 1.4px` of travel opens the
packet at 540ms. Under the shipped contract that release is SEALED —
opening is TWO-AXIS (`heldMs >= HOLD_TO_OPEN_MS && pullPx >=
OPEN_PULL_MIN_PX`), and `packetIntent.ts:491` literally asserts
`HOLD_TO_OPEN_MS === 450` as a contract-lock. Merging the parallel
module would have created two sources of truth that disagreed on the
central invariant.

## Orphan axes (all three, again)

1. **Zero consumers.** Grep for `packetIntentFeel` finds only the two
   new files.
2. **No CI lane runs the test.** `runPacketIntentFeelChecks` is absent
   from `aftersign/pure-runner.ts`, absent from
   `playwright.pure.config.ts`'s `testMatch`, and the pure lane's
   `testDir` is `e2e/` — a file under `apps/web/src/aftersign/` would
   not be discovered even if it were named `.spec.ts`.
3. **Typecheck lane doesn't gate the served surface.** Same shape as
   #1694 — a file inside `apps/web/src/aftersign/` sits outside
   `aftersign/tsconfig.json`'s `include: ["src"]`.

## The correct next step (unchanged from HANDOFF-1694)

If we want an EXPLICIT "preview" state distinct from SEALED, extend the
shipped contract — do not build a second one:

1. Add `PACKET_OUTCOME.PREVIEWED` (or a peer field) to
   `aftersign/src/packetIntent.ts`, keeping OPENED/SEALED/CANCELLED
   as-is.
2. Update `runPacketIntentChecks` in the same file to pin when
   PREVIEWED is emitted (e.g. short tap under some `PREVIEW_MAX_MS`)
   vs. SEALED.
3. Wire the new state through `apps/web/src/aftersign/packetChoiceFeel.ts`
   and the `#packetChoice` render site.
4. Add a jsdom/vitest consumer test under `apps/web/src/aftersign/`
   that proves the served surface renders the new state.

None of that lands in this PR — this PR is strictly the deletion.

## What this PR does

- Deletes `apps/web/src/aftersign/packetIntentFeel.ts`
- Deletes `apps/web/src/aftersign/packetIntentFeel.test.ts`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1698.md`

## What this PR does NOT do

- Does NOT modify `packetIntent.ts`, `packetChoiceFeel.ts`, or any
  shipped surface.
- Does NOT add a `PREVIEWED` outcome — same reason as #1694: it's a
  design question that deserves its own scoped PR anchored on the
  shipped contract.

Refs #1698
