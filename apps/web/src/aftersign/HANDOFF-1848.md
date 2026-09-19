# Handoff: packetIntentFeedback parallel-contract rejection (Refs #1760)

PR #1848 revision **deletes** `aftersign/src/packetIntentFeedback.js`.
Soren's REQUEST_CHANGES review was correct on every axis, and this is
the **fourth** repetition of the parallel-contract pattern already
documented in `HANDOFF-1694.md`, `HANDOFF-1698.md`, `HANDOFF-1760.md`,
and referenced in `HANDOFF-1791.md`. Read `HANDOFF-1760.md` first — the
resolution here is identical; this note only records what was specific
to #1848.

## Why deletion, not wiring

The shipped confirm-envelope contract already ships in two robust
forms that this module was reimplementing:

1. **`aftersign/src/routeRiskConfirmFeedback.js`** — the DOM-local
   confirmation envelope for the served path. Web Animations API,
   `prefers-reduced-motion` branch (brightness-only flicker for the
   vestibular contract), try/catch so decorative feedback can't break
   the durable commit, boolean return so callers can assert
   `=== true`. Pinned by `apps/web/src/aftersign/routeRiskMemory.ts:50-62`
   and Soren's REQUEST_CHANGES on #1840.
2. **`packages/aftersign/src/interactionConfirm.ts`** — the shared
   press/release cue vocabulary (`pressScale`, `releaseScale`), pinned
   by `apps/web/src/aftersign/interactionConfirm.test.ts`. Decisive
   cue: `pressScale = 0.97`, `releaseScale = 1.04`.

`packetIntentFeedback.js` re-modeled the same interaction with a
different vocabulary and different numbers:

| Concern                     | packetIntentFeedback.js (rejected)       | Shipped contracts                                              |
|-----------------------------|------------------------------------------|----------------------------------------------------------------|
| Vocabulary                  | `pressScale` / `settleScale`             | `pressScale` / `releaseScale` (`interactionConfirm.ts`)        |
| Press-scale number          | `0.975`                                  | `0.97` (`interactionConfirm.ts` "decisive")                    |
| Animation primitive         | `element.style.transition` + `setTimeout`| Web Animations API (`element.animate(...)`)                    |
| Reduced-motion branch       | (absent)                                 | brightness-only flicker (`routeRiskConfirmFeedback.js`)        |
| Try/catch around DOM writes | (absent)                                 | wraps `.animate(...)` so decorative feedback can't throw       |
| Boolean success return      | returns a cleanup thunk                  | returns `boolean` so callers can gate haptics                  |
| Test coverage               | (absent)                                 | `interactionConfirm.test.ts` pins the numbers                  |

The numbers diverge on the central invariant (`0.975` vs `0.97`), so
merging would have created a second source of truth for
"how far a confirmed choice presses" that disagrees with the pinned
surface. The animation primitive diverges too: `transition + setTimeout`
cannot be cancelled cleanly the way `element.animate(...)` can, and it
has no path for the reduced-motion vestibular contract.

## Orphan axes (all three, again)

1. **Zero consumers.** Grep for `packetIntentFeedback`,
   `playPacketIntentFeedback`, and `PACKET_INTENT_FEEDBACK` across the
   repo finds only the deleted file's own exports. `aftersign/main.js`
   and every other surface imports zero from it.
2. **No CI lane runs it.** Not registered in `aftersign/pure-runner.ts`,
   not matched by `playwright.pure.config.ts`'s `testMatch`, no
   `.test.js`/`.test.ts` sibling pinning the contract.
3. **No served-surface wire.** No `#packetIntent` render site imports
   it; no jsdom test asserts it renders on any frame.

## The correct next step (unchanged from HANDOFF-1694 / -1698 / -1760)

If we want an EXPLICIT press-feedback envelope for packet-intent
choices, extend the shipped contracts — do not build a fifth one:

1. If the cue is the same "confirm envelope" the route-risk fork
   uses, call `playRouteRiskConfirmFeedback(surface)` from the
   packet-intent tap handler in `aftersign/main.js` and rename the
   feel table to `AFTERSIGN_CONFIRM_FEEL` (or extract a shared
   `playConfirmFeedback` in `aftersign/src/confirmFeedback.js` that
   both forks import — one contract, two callers).
2. If the cue is a distinct "press cue" (not the confirm envelope),
   source its numbers from `packages/aftersign/src/interactionConfirm.ts`
   via `getInteractionConfirmCue("decisive")` so `pressScale` /
   `releaseScale` can't drift, and render through the shipped
   `#packetChoice` render site so a jsdom consumer test can pin it.
3. Add a `.test.ts` sibling under `apps/web/src/aftersign/` that
   asserts the served surface schedules the animation on the right
   frame (mirrors `interactionConfirm.test.ts`).

None of that lands in this PR — this PR is strictly the deletion.

## What this PR does

- Deletes `aftersign/src/packetIntentFeedback.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1848.md`

## What this PR does NOT do

- Does NOT modify `aftersign/main.js`, `routeRiskConfirmFeedback.js`,
  `interactionConfirm.ts`, `packetChoiceFeel.ts`, or any shipped
  surface.
- Does NOT add a packet-intent press-feedback envelope — that is a
  design question that deserves its own scoped PR anchored on the
  shipped contracts.

## Note to future-me

Four repetitions in a row (#1694, #1698, #1760, #1848) all had the
same shape: a "pure feel module" landed under `aftersign/src/` or
`aftersign/src/feel/` with no consumer, no CI registration, and
numbers that diverged from the pinned contract. The consumer rule
is decisive — **nothing ships until the served surface imports it
and a jsdom test proves it renders on the right frame**. My next
feel change starts by editing the shipped confirm contract
(`routeRiskConfirmFeedback.js` or `interactionConfirm.ts`) and the
render site TOGETHER, in the same PR, with the test.

Refs #1760
