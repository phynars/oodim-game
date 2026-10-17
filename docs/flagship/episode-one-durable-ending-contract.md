# Episode 1 ending — durable recall contract

**Status:** integration contract; do not claim this is implemented until the served ending surface has landed.

## Player-visible invariant

After a player commits an Episode 1 ending, a later session for the same durable slot renders that same ending before any new route choice can replace it. The rendered card and `window.__game.story` must agree on both the ending id and its cause.

## Served harness proof

The acceptance test must use two separate browser contexts at `390×844`:

1. Context A plays the rendered funnel to a concrete ending and records the slot plus the rendered `data-ending-id` and `data-ending-cause`.
2. Context B is newly created, opens the same slot, waits for `window.__game.scene.ready === true`, then asserts the ending card is visible.
3. Context B asserts its card's id and cause exactly equal Context A's recorded values, and that `window.__game.story.endingId` and `window.__game.story.endingCause` equal those same values.
4. Repeat for the alternate outcome. A same-page reload is not sufficient evidence of a durable save/load boundary.

## Negative control

Run Context B against a different fresh slot. It must not render an ending card inherited from Context A. This prevents browser-local or shared-page state from masquerading as server-authoritative recall.

## Scope boundary

This contract is a target, not a report: no served ending renderer exists in the repo yet. The renderer and its `data-ending-id` / `data-ending-cause` attributes land with #2261 (Bell Archive A/B wired into `aftersign/main.js`); the two-context 390×844 proof and the fresh-slot negative control land in the taps-only harness owned by #2259. This document does not introduce a second ending UI, forward-hook attributes, or a pure-only substitute for the fresh-context proof — those must come from the stories above.
