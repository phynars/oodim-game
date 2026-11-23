# Research — #2992 Unlit Door focused choice card

**Story:** #2992 · **Epic:** #2893 · **Date:** 2026-11-23

## Question

How should the Episode 1 Unlit Door moment make the named door visible and keep a phone player's attention on its three choices (keep the official record, protect the private lie, hang a new sign), without competing controls on the same card?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 2026-11-23 | Showing only the most important options at first helps people focus, reduces errors, and matters most on mobile screens. |
| R2 | [Avila & Schaffer, *Investigating the Impact of Progress Feedback and Tutorials with Progressive Disclosure on Player Experience*](https://dlnext.acm.org/doi/10.1007/978-3-031-92578-8_1) | 2026-11-23 | Frames progressive disclosure in games as something to test: does staged, nearby information improve the player's experience compared with showing everything at once? |

Internal references:

- #2992 defines the player outcome. The card names "The Unlit Door", does not show "Act II — Bell Archive", carries only the three door choices with a one-line description each, and fits them at 390×844 with tap targets at least 44px tall.
- `docs/flagship/BRIEF.md` (M5 Unlit Door section) names the three choices: keep the official record, protect the private lie, hang a new sign. It also says "The three door choices are stored and reach three different end screens."
- `docs/flagship/devlog.md` records the playtest finding behind this story. The player did not understand what the three buttons would do, and the buttons were small and clipped by the card's bottom corner.
- #2894 (research, spec and design for the Unlit Door choice and ending) and #2893 (the M6 epic for the opening of Episode 2).

## What we adopt / what we reject

- **Adopt:** Put "The Unlit Door" in the card's main heading, above the choice controls, so players know what the object is before they decide. Remove the "Act II — Bell Archive" heading from this card. (R1)
- **Adopt:** The card holds only the three door-choice controls: "Keep the official record", "Protect the private lie" and "Hang a new sign". Leave these off the card: "Carry the name to the Bell Archive", "Red tag — Saint Orra", the return replies and the name buttons. Status, recap and navigation sit outside the card or wait for the next beat. (R1)
- **Adopt:** Give each of the three choices a one-line description of what it does. The "Protect the private lie" line must say what the lie is. Keep the narrative voice already used in the game. This is a design idea to test, not a proven game result. (R2)
- **Adopt:** At 390×844, stack the three choice buttons so each fits fully inside the visible card, with no clipped label or description and a tap target at least 44px tall. This fixes the clipping seen in the playtest. (R1)
- **Reject:** More controls, lore or settings on the decision card. They pull attention from the door decision and go against focused progressive disclosure. (R1)

## Open questions for the spec

- What one-line description for each choice (official record / private lie / new sign) fits the Episode 1 consequence model and the ending memory? It must name the private lie without claiming anything the player did not tap.
- Is the door shown with an existing scene illustration, a new asset or a CSS composition, and what text alternative names it?
- Which controls stay visible outside the card without a player mistaking them for a fourth door choice?
- What layout and copy-length limits keep all three buttons and their descriptions inside the card at 390×844, with each button at least 44px tall?
- What served test at the phone viewport taps "Go to the Unlit Door", then checks four things: the heading, that "Act II — Bell Archive" and the listed controls are absent, the three descriptions, and each button's bounds and height?
