# Research — #2848 phone scrolling for the second job list

**Story:** #2848 · **Epic:** #2821 · **Date:** 2026-11-16

## Question

How should the served second job list behave at a 390×844 phone viewport so that
"Night transfer" remains visible and a player can scroll to and choose "Signed
receipt" without relying on a test-only input path?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [MDN: `scrollbar-width`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width) | 2026-11-16 | Hiding a scrollbar can make content hard or impossible to scroll on devices without an alternative. Scrollable content must remain directly operable. |
| R2 | [MDN: `::-webkit-scrollbar`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-scrollbar) | 2026-11-16 | Non-standard scrollbar styling is discouraged; if a scrollbar is styled, its contrast and touch-target size need accessibility consideration. |

Internal references: #2848 requires the served page at 390×844 to show "Night
transfer", allow touch or wheel scrolling to "Signed receipt", and advance
when that visible option is tapped. `packages/aftersign/src/computeOfferedJobs.ts`
contains those offered-job labels.

## What we adopt / what we reject

- **Adopt:** Make the job-list region directly scrollable by player touch and wheel input, while retaining a visible, reachable option control after scrolling (R1).
- **Adopt:** Prefer native scrolling behavior rather than browser-specific scrollbar customization (R2).
- **Reject:** A fixed-height, clipped list that requires a harness input hook or programmatic scrolling; it fails the story's direct player-operation requirement (R1).
- **Reject:** Solving the viewport constraint by hiding the overflow affordance with `scrollbar-width: none`; MDN identifies that as an accessibility risk (R1).

## Open questions for the spec

- Which visible container owns the overflow at 390×844, and what bounded height leaves "Night transfer" fully readable before the player scrolls?
- Which served Playwright scenario reaches the second offer list by visible taps, scrolls the list by pointer and wheel, then taps the visible "Signed receipt" control?
- Does the existing option control meet the project’s phone touch-target expectations after the list becomes scrollable?
