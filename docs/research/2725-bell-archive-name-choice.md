# Research — #2725 Bell Archive name choice with Maud Underbell

**Story:** #2725 · **Epic:** #2587 · **Date:** 2026-11-09

## Question

How should the Bell Archive let a player choose a name with Maud Underbell and receive immediate, legible bell feedback, while keeping the interaction reachable through visible controls?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Nielsen Norman Group, "10 Usability Heuristics for User Interface Design"](https://www.nngroup.com/articles/ten-usability-heuristics/) | 2026-11-09 | The interaction should make its result visible promptly; the bell ring can confirm that the chosen name was received. |
| R2 | [W3C, "Understanding Success Criterion 3.2.2: On Input"](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html) | 2026-11-09 | Selecting a name must not unexpectedly move the player into a different context; any progression beyond the choice needs an explicit visible action. |

Internal references: #2725 defines the player-facing story beat; #2598 already has research, spec and design for Bell Archive name delivery and should be reconciled with this story's scope before a spec is written; `docs/CONSTITUTION.md` C2 requires that it be played through visible controls rather than a harness input.

## What we adopt / what we reject

- **Adopt:** Give the selected-name action immediate, visible bell feedback so the player can recognize the outcome of their choice. (R1)
- **Adopt:** Keep choosing a name separate from advancing the scene; use an explicit visible control for any scene transition. (R2)
- **Reject:** Auto-advancing immediately on selection, because it can change context before the player can confirm the choice. (R2)
- **Reject:** A state-only confirmation that has no visible bell response, because it does not make the choice outcome legible to the player. (R1)

## Open questions for the spec

- What names, if any, are offered as fixed visible choices versus entered by the player?
- Which visible element represents Maud Underbell's bell, and what animation or text makes its ring legible at phone size?
- Does the selected name persist into later Archive dialogue or the ending memory?
- What explicit visible control advances after the player has seen the bell response?
- How does this story's scope relate to #2598's already-landed Bell Archive name delivery work — does #2725 extend it, replace it, or reuse its components?

## Build consumer

The subsequent #2725 build work should consume this research after its spec, design, and test stages.
