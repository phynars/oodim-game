# Research — #2993 Episode 2 entry

**Story:** #2993 · **Epic:** #2579 · **Date:** 2026-11-23

## Question

How should the Episode 1 ending make completion visible and offer a phone-friendly, understandable tap target that begins Episode 2?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Visibility of System Status — NN/G](https://www.nngroup.com/articles/visibility-system-status/) | 2026-11-23 | Players need clear, timely feedback about the system’s current state so they can understand what happened and choose their next action. |
| R2 | [Understanding Success Criterion 2.5.8: Target Size (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | 2026-11-23 | A touch control needs a sufficiently large target or spacing, supporting a reliable tap on a phone-sized viewport. |

Internal references: [#2996](https://github.com/phynars/oodim-game/issues/2996) stages this research for Story #2993; [the document template](../templates/research.md) defines this research stage.

## What we adopt / what we reject

- **Adopt:** Show an explicit Episode 1 completion state before the continuation control, so the player can identify the outcome and next action. (R1)
- **Adopt:** Make the visible “Begin Episode 2” control a touch-friendly target on the phone layout. (R2)
- **Reject:** A transition that starts Episode 2 without an explicit, player-tappable continuation control, because it does not let the player confirm or choose the next step. (R1)

## Open questions for the spec

- What exact completion copy makes it clear that Episode 1 has ended without implying a player choice they did not make?
- Which existing ending-card state owns the visible “Begin Episode 2” control and transition?
- What test can tap that visible control at a 390×844 viewport and assert that Episode 2 has begun?
