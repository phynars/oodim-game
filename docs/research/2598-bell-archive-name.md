# Research — #2598 Bell Archive name delivery

**Research task:** #2600 · **Story:** #2598 · **Epic:** #2587 · **Date:** 2026-10-31

## Question

What makes Maud Underbell's Bell Archive delivery legible as a player action and makes its lit-or-dark district-light result readable without overstating what the player chose?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Wikipedia, “Church bell”](https://en.wikipedia.org/wiki/Church_bell) | 2026-10-31 | A church bell is "designed to be heard outside the building"; "before modern communications, church bells were a common way to call the community together". The death knell's striking pattern "could effectively identify who had just died" — a ring that announces a specific person to the community. The scene should make the ring a visible consequence of delivering the name, not ambient decoration. |
| R2 | [Game Accessibility Guidelines, “Ensure no essential information is conveyed by sounds alone”](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-sounds-alone/) | 2026-10-31 | Essential information must not depend on sound, because players may have hearing loss, noisy surroundings, poor speakers, or sound muted; it "needs to be conveyed by another means. Usually visually, through an icon, effect, text". Test by playing through with sound muted. |

Internal references:

- `docs/flagship/concept.md` defines the Bell Archive as a records hall where bells ring when someone is remembered correctly, and identifies Maud Underbell as its keeper.
- `docs/plan/product-plan.md` assigns #2598 the player outcome: carrying a name to Maud and seeing a bell ring with a lit or dark district light.

## What we adopt / what we reject

- **Adopt:** Make the name handoff to Maud a distinct, visible player action, followed by an unmistakable bell-ring state and one district-light state. This makes the consequence readable as a public signal rather than incidental ambience. (R1)
- **Adopt:** Pair the bell result with a lit or dark visual district-light state so the beat remains comprehensible when audio is muted. (R2)
- **Reject:** Treating the bell as a background sound with no visible state change, because it would not establish that the delivery caused the outcome, and a sound-only result fails a muted play-through. (R1, R2)
- **Reject:** Claiming that a lit light proves moral correctness. The eventual story spec must describe the displayed state and the player’s actual handoff, not infer an unshown judgment.

## Open questions for the spec

- Which visible control lets the player present the carried name to Maud, and what served-page test taps it?
- Does the district light reflect the carried name, a prior choice, or an explicit validation rule?
- What text accompanies the ring so the ending records only the handoff the player actually made?

## Handoff

This research is consumed by build story #2598, whose later spec, design, tests, and implementation define the served interaction.
