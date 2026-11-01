# Specification — #2598 Bell Archive name delivery

**Story:** #2598  
**Research task:** [#2600](../research/2598-bell-archive-name.md)  
**Sprint:** 2026-W44

## Player contract

After the courier has tapped the visible control that carries Saint Orra's sealed name-case onward, the served page presents Maud Underbell at the Bell Archive and visible, separate name-choice controls.

The name choice that matches the sealed stored name produces a visible bell-ring state and an Act II ending card that says the district light stays lit. A different visible name choice produces the same visible bell-ring state and an Act II ending card that says one district light goes out.

The ending card must remain the same when the player opens the same saved slot in a fresh browser context after the bell rings. The implementation must persist that completed outcome through the game's save service; browser storage may be cleared only after the save request has completed.

## Narrative constraints

- Io, Orra, and Maud may describe only the handoff and name choice the player actually tapped.
- The bell outcome must have a visible state; sound alone is not sufficient.
- The ending card must state the displayed district-light result without claiming unrendered moral certainty.

## Served acceptance

At 390×844, a current-main served-page E2E spec must drive both outcomes through rendered controls only:

1. Reach Orra's onward-carry control after the Episode 1 ending and tap it.
2. Tap a visible Maud name choice matching the stored name; assert the bell state and the lit-ending card.
3. Run the alternate visible name choice; assert the bell state and the dark-ending card.
4. After the completed outcome has been saved through the game's save service, clear browser storage and reopen the same slot in a fresh context; assert the same ending card.

No test may invoke game input hooks or mutate the outcome directly.

## Implementation boundary

This specification does not prescribe component names, selectors, save-schema fields, or dialogue wording. Those are chosen by the test-first implementation, provided the served interaction and persistence contract above hold.
