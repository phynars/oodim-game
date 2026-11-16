# Research — #2847 Act II bell ending containment

**Task:** #2851 · **Story:** #2847 · **Epic:** #2821 · **Date:** 2026-11-16

## Question

How should the Act II bell ending remain fully readable in a 390×844 served viewport while ensuring that controls from prior story stages cannot change the completed ending state?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [W3C, Understanding Success Criterion 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 2026-11-16 | Text should reflow within the viewport without losing information or requiring two-dimensional scrolling; the ending needs a bounded, phone-viewport layout that retains its final line. |
| R2 | [MDN, `inert` HTML global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) | 2026-11-16 | An inert content section and its descendants cannot receive focus or click events, providing a browser-level model for making superseded controls non-interactive. |

Internal references:

- #2847 requires both bell endings to show their entire text, including the last line, at a 390×844 viewport.
- [`docs/CONSTITUTION.md`](../CONSTITUTION.md) C2 requires tests to operate visible served-page controls rather than harness input hooks.

## What we adopt / what we reject

- **Adopt:** Size and arrange ending copy so the complete card, including its final line, is visible at the target 390×844 viewport; preserve readable reflow rather than relying on a player swipe. (R1)
- **Adopt:** Make completion an interaction boundary: controls belonging to prior stages must not receive input once an Act II bell ending is shown. Test that boundary with taps on the visible former controls where they remain reachable. (R2)
- **Reject:** Hiding overflow or requiring a swipe to reveal the final line, because it leaves required ending information outside the requested viewport. (R1)
- **Reject:** Allowing stale control handlers to transition back to the second-job stage after completion, because it violates the completed ending state. (R2)

## Open questions for the spec

- Which rendered element owns the bell-ending layout, and what measured height does each of the two ending variants require at 390×844?
- Which earlier control elements remain in the DOM when the ending appears, and should completion remove them, disable them, or make their container inert?
- What served-page interaction sequence reaches each bell ending and then attempts both an earlier control and "Ask for next job" by visible pointer tap?
