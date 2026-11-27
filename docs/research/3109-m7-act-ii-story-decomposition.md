# Research — #3109 M7 Act II story decomposition

## Decision

M7 is delivered as three ordered, independently shippable stories. The first two are closed delivery records; the third is the remaining closeout-evidence slice. Together they scope the implementation and verification required by epic #3030 without combining runtime branching, the Child interaction, durable restoration, and phone replay in one change.

| Order | Story | Status | Dependency | Affected paths |
| --- | --- | --- | --- | --- |
| 1 | #3032 — Act I end-card continuation into Act II | Closed | Act I end card and stored shortcut answer | `aftersign/main.js`, `aftersign/src/runtime/persistence.js` |
| 2 | #3033 — Unaddressed Child answer | Closed | #3032 Act II opening | `aftersign/main.js`, `aftersign/src/runtime/persistence.js` |
| 3 | #3110 — Act II closeout restoration and phone replay | Open | #3032 and #3033 | `aftersign/src/runtime/persistence.js`, `aftersign/e2e/` |

## Story 1 — branch opening

**Acceptance**

- A stored `take` shortcut answer opens an Act II scene with its own visible text, controls, and stored scene id.
- A stored `refuse` shortcut answer opens a scene with different visible text, controls, and scene id.
- Reloading mid-Act II restores the opening selected by the stored shortcut answer.

**Boundary:** This story does not introduce the Child question, an Act II ending, or phone closeout replay.

## Story 2 — Child question and answer

**Acceptance**

- The Unaddressed Child offers exactly an `I don't know` answer and a confident answer when the player reaches the Child.
- Tapping either visible answer stores it and shows it on the Act II end card.
- The Child's line refers only to values already present in stored state; it must not claim an unstored memory.

**Boundary:** This story does not change which shortcut branch opened Act II or add browser-context replay coverage.

## Story 3 — restored end card and phone evidence

**Acceptance**

- Completing Act II persists the shortcut answer, Child question, and Child answer required to render the Act II end card.
- Reopening the same slot in a fresh browser context restores that card with the same values.
- A 390×844, touch-enabled Playwright spec reaches the end card through taps/clicks on visible controls only, covers both stored shortcut branches, and uses no `window.__game` input hook.
- Every player control that reveals new content brings it into the bounded panel's visible area at that viewport without a manual swipe.

**Boundary:** This story adds no new districts, 3D scenes, Episode 3 content, weekly-drop work, or Mara Vell dialogue.

## Shared constraints

All three stories retain #3030's facts-only dialogue rule and phone visibility requirement. Runtime changes belong to the first two stories; the final story is limited to persistence completion and served phone-path evidence.
