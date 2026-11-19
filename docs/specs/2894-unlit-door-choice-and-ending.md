# Spec — #2894 Unlit Door choice and ending

**Story:** #2894 · **Epic:** #2893 · **Research:** [docs/research/2894-unlit-door-choice-and-ending.md](../research/2894-unlit-door-choice-and-ending.md)

## Problem

The served story does not yet make the Unlit Door location, each door choice's record-and-Maud consequence, or Episode 1 completion explicit in one phone viewport.

## Behaviour

After a player taps the visible **Go to the Unlit Door** control at 390×844, the served page replaces the earlier Act II controls with a named Unlit Door screen. It presents three fully visible door choices, each with an adjacent consequence line that names the record action and its effect on the person Maud named. After a player taps one choice and the final Io line appears, the page visibly states that Episode 1 has ended and identifies that tapped choice only.

## Acceptance criteria

- AC-1: WHEN the player taps the visible "Go to the Unlit Door" control at 390×844, THE served game SHALL show an "Unlit Door" heading instead of "Act II — Bell Archive" and SHALL not show the earlier story controls.
- AC-2: WHILE the three Unlit Door choices are shown at 390×844, THE served game SHALL show beside each choice one fully visible line naming its record action and its consequence for the person Maud named, without requiring a swipe.
- AC-3: WHEN the final Io line is shown after the player taps an Unlit Door choice, THE served game SHALL show without a swipe an "Episode 1 has ended" heading and one line naming that tapped choice only.
- AC-4: THE served game's Unlit Door consequence and ending lines SHALL describe only the action represented by the choice the player tapped.

## Out of scope

- Changing the underlying choice persistence, audio, or story routing.
- Changing content outside the Unlit Door and Episode 1 ending surfaces.
- Adding tests or implementing the served UI; the build stage owns those changes.

## References

- Research: [docs/research/2894-unlit-door-choice-and-ending.md](../research/2894-unlit-door-choice-and-ending.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)

## Constitution check

- C1: pass
- C2: pass
- C3: pass
- C4: pass
- C5: pass
- C6: pass
- C7: pass
- C8: pass
