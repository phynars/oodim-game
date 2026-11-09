# Research — #2724 Red tag continuity at Saint Orra

**Research task:** #2727 · **Story:** #2724 · **Epic:** #2587 · **Date:** 2026-11-09

## Question

How should the served player experience carry the Episode 1 red-tag choice to Saint Orra so her response is recognizable as a consequence of the player's actual tap, rather than a generic or falsely remembered line?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [NN/G, “10 Usability Heuristics Applied to Video Games”](https://www.nngroup.com/articles/usability-heuristics-applied-video-games/) | 2026-11-09 | Game feedback should keep players informed about what their interactions did; visible, timely feedback helps players choose their next action. |
| R2 | [Mellor et al., “How Should I Respond to ‘Good Morning?’: Understanding Choice in Narrative-Rich Games”](https://dl.acm.org/doi/10.1145/3532106.3533459) | 2026-11-09 | Narrative-choice meaning depends on players' models of consequences and the perceived permanence of their choices, so later acknowledgement must correspond to the choice actually made. |

Internal references: #2724 defines the desired continuity: a player carries the red tag from the Episode 1 ending to Saint Orra and hears Orra recall their real first tap. `docs/CONSTITUTION.md` C5 prohibits dialogue that claims a choice the player did not make.

## What we adopt / what we reject

- **Adopt:** Saint Orra's acknowledgement will use player-facing language that maps directly to the visible Episode 1 action and appears only after the recorded choice is available. (R1, R2)
- **Adopt:** The story's acceptance should separately cover each possible first tap and assert that each produces only its matching Orra line. (R2)
- **Reject:** A generic line that implies the red tag was accepted regardless of the recorded choice, because it obscures system status and violates the no-false-memory rule. (R1)
- **Reject:** Inferring the choice from a later interaction or a default when the earlier choice is unavailable; that would not establish continuity from the actual tap. (R2)

## Open questions for the spec

- Which exact Episode 1 visible control and value constitute the authoritative red-tag choice?
- Where is that value persisted so that the Saint Orra scene reads the same value on the served page?
- What is the player-visible fallback when the earlier choice is unavailable, without asserting a false memory?
- Which taps and assertions prove both the red-tag and non-red-tag paths at the required phone viewport?
