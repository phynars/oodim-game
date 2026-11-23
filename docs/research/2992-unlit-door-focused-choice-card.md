# Research — #2992 Unlit Door focused choice card

**Story:** #2992 · **Epic:** #2893 · **Date:** 2026-11-23

## Question

How should the Episode 1 Unlit Door moment make the named door visible and keep a phone player’s attention on its decision, without competing controls on the same card?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 2026-11-23 | Initially showing only the most important options helps people prioritize attention, reduces errors, and is especially relevant on mobile surfaces. |
| R2 | [Avila & Schaffer, *Investigating the Impact of Progress Feedback and Tutorials with Progressive Disclosure on Player Experience*](https://dlnext.acm.org/doi/10.1007/978-3-031-92578-8_1) | 2026-11-23 | Research framing progressive disclosure in games supports evaluating whether staged, proximal information improves player experience rather than presenting all material at once. |

Internal references: #2992 defines the player outcome: the Unlit Door is named and shown, and the card contains only door choices. #2893 is the M6 epic for Episode 2’s opening.

## What we adopt / what we reject

- **Adopt:** Put the explicit name “Unlit Door” in the decision card’s primary heading or scene label, before the choice controls, so the object is identifiable before a player decides. This is a story proposal to validate in the spec and served test. (R2)
- **Adopt:** Keep only the two door-decision controls in that card; move status, recap, navigation, and non-decision affordances outside the card or behind the next beat. (R1)
- **Adopt:** Give each choice an action-oriented label and a short consequence cue, while retaining the existing narrative voice. This is a design hypothesis, not a tested game outcome. (R2)
- **Reject:** Adding more controls, lore, or settings to the decision card. Those compete with the immediate door decision and contradict focused progressive disclosure. (R1)

## Open questions for the spec

- What exact two door choices preserve the Episode 1 consequence model and truthful ending memory?
- Is the door shown with an existing scene illustration, a new asset, or a CSS composition, and what text alternative names it?
- Which visible controls remain available outside the card without making the player mistake them for a third door choice?
- What served phone-viewport test demonstrates that the named door and exactly two door choices are visible and tappable?
