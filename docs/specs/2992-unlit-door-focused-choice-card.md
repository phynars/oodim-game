# Spec — #2992 Unlit Door focused choice card

**Story:** #2992 · **Epic:** #2893 · **Delivery task:** #2999 · **Research:** [docs/research/2992-unlit-door-focused-choice-card.md](../research/2992-unlit-door-focused-choice-card.md)

## Problem

After the player taps **Go to the Unlit Door**, the card can retain the prior **Act II — Bell Archive** identity and unrelated story controls. Its door-choice buttons are only 32px high in the current renderer, below the phone tap-target requirement, and the private-lie consequence does not say what the lie is. A player cannot reliably identify the moment or understand the decision before tapping.

## Behaviour

A player taps the visible **Go to the Unlit Door** button at a 390×844 viewport. The existing ending card becomes a focused **The Unlit Door** card: it presents the named door and exactly its three decision controls. Each decision presents a concise consequence beneath its button; the private-lie choice explicitly says that the lie is the false name placed in the record. The card keeps every choice and its explanatory line inside the visible panel, and each choice button has a tap target at least 44px tall.

## Acceptance criteria

- AC-1: WHEN the player taps the visible "Go to the Unlit Door" control at 390×844, THE served game SHALL show a heading "The Unlit Door" and SHALL NOT show "Act II — Bell Archive" on that card.
- AC-2: WHILE the Unlit Door card is shown, THE served game SHALL render only the three door-choice controls and SHALL NOT render "Carry the name to the Bell Archive", "Red tag — Saint Orra", return replies, or name-choice controls on that card.
- AC-3: WHILE the Unlit Door card is shown, THE served game SHALL show a one-line consequence beneath each door choice, and the "Protect the private lie" consequence SHALL identify the lie as the false name placed in the record.
- AC-4: WHILE the Unlit Door card is shown at 390×844, THE served game SHALL keep every door-choice button and consequence fully inside the visible card bounds with no clipped text, and SHALL give each button a tap target at least 44px tall.

## Out of scope

- Altering what a selected door choice persists or the Episode 1 completion receipt.
- Adding an illustration or other new visual asset for the door.
- Changing controls on story beats before the player opens the door.

## References

- Research: [docs/research/2992-unlit-door-focused-choice-card.md](../research/2992-unlit-door-focused-choice-card.md)
- Architecture: [docs/plan/architecture/README.md#runtime-boundaries](../plan/architecture/README.md#runtime-boundaries)

## Constitution check

- C1: pass
- C2: pass
- C3: pass
- C4: pass
- C5: pass
- C6: pass
- C7: pass
- C8: pass
