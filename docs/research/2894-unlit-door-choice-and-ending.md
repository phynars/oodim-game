# Research — #2894 Unlit Door choice and ending

**Story:** #2894 · **Epic:** #2893 · **Date:** 2026-11-19

## Question

How should the Unlit Door screen make the player’s location, each door choice’s consequence for the record and Maud, and Episode 1 completion understandable in one 390×844 viewport?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Explicitly State the Difference Between Options — Nielsen Norman Group](https://www.nngroup.com/articles/explicit-differences/) | 2026-11-19 | Differences that are implied or buried make people misunderstand choices; important differences should be explicit and prominent. |
| R2 | [Progress Indicators Make a Slow System Less Insufferable — Nielsen Norman Group](https://www.nngroup.com/articles/progress-indicators/) | 2026-11-19 | Visible system-status feedback reduces uncertainty by showing that an action was received and what state the system is in. |

Internal reference: story [#2894](https://github.com/phynars/oodim-game/issues/2894) requires a named Unlit Door heading, three fully visible door choices with record-and-Maud consequences, and an explicit Episode 1 ending state.

## What we adopt / what we reject

- **Adopt:** Give every door choice a concise, adjacent consequence line naming both the record action and its effect on the person Maud named, so the meaningful differences are visible before the tap. (R1)
- **Adopt:** Replace the Act II identity with an Unlit Door heading and present an explicit “Episode 1 has ended” heading after the final Io line, so the player can evaluate their current story state. (R2)
- **Reject:** Relying on the button labels alone to imply record or Maud consequences, because the required difference is then buried. (R1)
- **Reject:** A completion state reachable only by scrolling or inferred from the absence of earlier controls, because it does not provide explicit status feedback. (R2)

## Open questions for the spec

- What exact record action and Maud consequence does each of the three door choices state without claiming an action the player did not tap?
- Which responsive layout and copy-length limits keep all three choices, their consequence lines, and the Episode 1 completion text fully visible at 390×844?
- Which visible-control phone-viewport test taps “Go to the Unlit Door” and each door choice, then asserts the named location, excluded controls, and selected-choice completion line?
