# Research — #2846 Safe-route trust acknowledgement

**Story:** #2846 · **Epic:** #2821 · **Date:** 2026-11-16

## Question

How should the Act II ending acknowledge a player's choice about the safe job without
claiming they took an action they did not tap?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Foreseeing Meaningful Choices](https://doi.org/10.1609/aiide.v10i1.12716) | 2026-11-16 | A choice contributes to agency when it produces meaningfully different content; an ending should therefore distinguish accepting the safe job from declining it. |
| R2 | [“Naked and on Fire”: Examining Player Agency Experiences in Narrative-Focused Gameplay](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445540) | 2026-11-16 | Players' sense of agency depends on feedback that acknowledges their decisions, including later consequences; ending copy should acknowledge only the decision actually made. |

This research is delivered by [research task #2850](https://github.com/phynars/oodim-game/issues/2850) for [story #2846](https://github.com/phynars/oodim-game/issues/2846). Story #2846 requires the served Act II ending to omit “you made the safe route worth trusting again” unless the player tapped “Take the safe job.” [CONSTITUTION.md](../CONSTITUTION.md) C5 prohibits false memory, and C2 requires player-driven visible-control taps in served acceptance.

## What we adopt / what we reject

- **Adopt:** Branch ending language by the recorded safe-job choice so accepting and declining receive meaningfully different acknowledgement. (R1)
- **Adopt:** Use only language the player can map to the visible control they tapped; verify it through visible-control taps rather than harness input. (R2)
- **Reject:** A shared trust-restoration ending line for both routes, because it attributes accepting the safe job to a player who declined it.

## Open questions for the spec

- Which recorded choice value represents tapping “Take the safe job,” and where is it persisted through the Act II ending?
- What exact ending line acknowledges declining the safe job without implying the safe route became trustworthy again?
- Which served Playwright journey reaches each ending at 390×844 by tapping visible controls?
