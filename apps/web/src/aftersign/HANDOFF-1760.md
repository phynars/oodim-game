# Handoff: packetChoicePress parallel-contract rejection (Refs #1698)

PR #1760 revision **deletes** `aftersign/src/feel/packetChoicePress.ts`.
Soren's REQUEST_CHANGES review was correct on every axis, and this is
the **third** repetition of the parallel-contract pattern already
documented in `HANDOFF-1694.md` and `HANDOFF-1698.md`. Read those two
first — this note only records what was specific to #1760.

## Why deletion, not revision

The shipped packet-choice feel contract is
`apps/web/src/aftersign/packetChoiceFeel.ts`. Its vocabulary for the
central press interaction is
`"seal-strain" | "seal-break" | "seal-safe"` with timing thresholds
sourced from `packetIntent.ts` (`HOLD_TO_OPEN_MS = 450`,
`preserveTapMaxMs = 180`, `previewTapMaxMs = 60`,
`releaseGraceMs` from the pure release-forgiveness contract). It is
rendered through the `#packetChoice` render site and pinned by the
jsdom consumer tests under `apps/web/src/aftersign/`.

`packetChoicePress.ts` re-modeled the same interaction with a
different vocabulary and different numbers:

| Concern                     | packetChoicePress.ts (rejected) | packetChoiceFeel.ts (shipped)                          |
|-----------------------------|---------------------------------|--------------------------------------------------------|
| State labels                | `"idle" \| "pressed" \| "committed"` | `"seal-strain" \| "seal-break" \| "seal-safe"` (+ `previewed`) |
| Press-window cap            | `PACKET_CHOICE_PRESS_MAX_MS = 80` | `previewTapMaxMs = 60`, `preserveTapMaxMs = 180`     |
| Scale on press              | `PACKET_CHOICE_PRESS_MIN_SCALE = 0.96` | (owned by render site, not the pure judge)      |
| Release forgiveness         | (absent)                        | Delegated to pure `isReleaseInsideForgivenessWindow`   |
| Preview-glance branch       | (absent)                        | `feedback: "previewed"` for taps `<= previewTapMaxMs`  |

The numbers diverge on the central invariant: the shipped contract
treats sub-60ms as a non-committal preview and up to 180ms (+ grace)
as a preserve-commit, while the orphan module collapses everything
under 80ms into a single `"pressed"` state with no notion of preview
vs. preserve vs. break. Merging would have created a second source of
truth that disagreed with the pinned surface.

## Orphan axes (all three, again)

1. **Zero consumers.** Grep for `packetChoicePressState`,
   `packetChoicePressScale`, and `PACKET_CHOICE_PRESS` finds only the
   deleted file. Nothing in `apps/web/src/aftersign/` or the pure
   lane imports it.
2. **No CI lane runs it.** Not registered in
   `aftersign/pure-runner.ts`, not matched by
   `playwright.pure.config.ts`'s `testMatch`, no `.test.ts` sibling.
3. **No served-surface wire.** The `#packetChoice` render site does
   not import it; no jsdom test asserts it renders anywhere.

## The correct next step (unchanged from HANDOFF-1694 / HANDOFF-1698)

If we want an EXPLICIT press-visual state distinct from the existing
`seal-strain` / `seal-break` / `seal-safe` / `previewed` set, extend
the shipped contract — do not build a second one:

1. Add the new state (or a peer field like `pressPhase`) to
   `apps/web/src/aftersign/packetChoiceFeel.ts`, sourcing any timing
   thresholds from `packetIntent.ts` / the pure release-forgiveness
   module so numbers can't drift.
2. Wire the new state through the `#packetChoice` render site so it
   actually reaches the served surface.
3. Add a jsdom/vitest consumer test under `apps/web/src/aftersign/`
   that proves the served surface renders the new state on the right
   frame.
4. If the state affects any pure invariant, pin it under
   `runPacketIntentChecks` in `aftersign/src/packetIntent.ts` and let
   `aftersign/pure-runner.ts` register it — so `test:aftersign:pure`
   fails when the invariant breaks.

None of that lands in this PR — this PR is strictly the deletion.

## What this PR does

- Deletes `aftersign/src/feel/packetChoicePress.ts`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1760.md`

## What this PR does NOT do

- Does NOT modify `packetChoiceFeel.ts`, `packetIntent.ts`, or any
  shipped surface.
- Does NOT add a press-visual state — that is a design question that
  deserves its own scoped PR anchored on the shipped contract.

## Note to future-me

Three repetitions in a row (#1694, #1698, #1760) all had the same
shape: a "pure feel module" landed under `aftersign/src/feel/` or
`apps/web/src/aftersign/` with no consumer, no CI registration, and
numbers that diverged from the pinned contract. The consumer rule is
decisive — nothing ships until the served surface imports it and a
jsdom test proves it renders. Next feel change starts by editing
`packetChoiceFeel.ts` and the `#packetChoice` render site TOGETHER,
in the same PR, with the test.

Refs #1698
