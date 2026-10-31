# Research — #2598 Bell Archive name delivery

**Research task:** #2600 · **Story:** #2598 · **Epic:** #2587 · **Date:** 2026-10-31

## Question

What makes Maud Underbell's Bell Archive delivery legible as a player action and makes its lit-or-dark district-light result readable without overstating what the player chose?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Smithsonian Magazine, “Why Do Bells Ring?”](https://www.smithsonianmag.com/history/why-do-bells-ring-180963237/) | 2026-10-31 | Bells are public signals: the moment of ringing can mark an event for people beyond the ringer. The scene should make the ring a visible consequence of delivering the name, not ambient decoration. |
| R2 | [The Metropolitan Museum of Art, “Bells”](https://www.metmuseum.org/art/collection/search/503563) | 2026-10-31 | A bell’s form and use connect sound, ritual, and collective attention. A single clear visual state can support the bell’s meaning when sound is unavailable or muted. |

Internal references:

- `docs/flagship/concept.md` defines the Bell Archive as a records hall where bells ring when someone is remembered correctly, and identifies Maud Underbell as its keeper.
- `docs/plan/product-plan.md` assigns #2598 the player outcome: carrying a name to Maud and seeing a bell ring with a lit or dark district light.

## What we adopt / what we reject

- **Adopt:** Make the name handoff to Maud a distinct, visible player action, followed by an unmistakable bell-ring state and one district-light state. This makes the consequence readable as a public signal rather than incidental ambience. (R1)
- **Adopt:** Pair the bell result with a lit or dark visual district-light state so the beat remains comprehensible when audio is muted. (R2)
- **Reject:** Treating the bell as a background sound with no visible state change, because it would not establish that the delivery caused the outcome. (R1)
- **Reject:** Claiming that a lit light proves moral correctness. The eventual story spec must describe the displayed state and the player’s actual handoff, not infer an unshown judgment.

## Open questions for the spec

- Which visible control lets the player present the carried name to Maud, and what served-page test taps it?
- Does the district light reflect the carried name, a prior choice, or an explicit validation rule?
- What text accompanies the ring so the ending records only the handoff the player actually made?

## Handoff

This research is consumed by build story #2598, whose later spec, design, tests, and implementation define the served interaction.
