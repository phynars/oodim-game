# Spec — #2598 Bell Archive name delivery

**Story:** #2598 · **Epic:** #2579 · **Research:** [docs/research/2598-bell-archive-name.md](../research/2598-bell-archive-name.md)

## Problem

After the Episode 1 ending, the courier can carry Saint Orra's sealed name-case onward, but nothing receives it: Maud Underbell and the Bell Archive are not on the served page, no name can be chosen, the bell never rings, and no Act II ending is shown or kept for the save slot.

## Behaviour

1. After the Episode 1 ending, the courier taps the visible control that carries Saint Orra's sealed name-case onward.
2. The served page presents Maud Underbell at the Bell Archive with visible, separate name-choice controls.
3. Tapping the name choice that matches the sealed stored name shows a visible bell-ring state and an Act II ending card saying the district light stays lit.
4. Tapping a different name choice shows the same visible bell-ring state and an Act II ending card saying one district light goes out.
5. The completed outcome is persisted through the game's save service; reopening the same slot in a fresh browser context shows the same ending card.

Narrative constraints:

- Io, Orra, and Maud describe only the handoff and name choice the player actually tapped.
- The bell outcome has a visible state; sound alone is not sufficient.
- The ending card states the displayed district-light result without claiming unrendered moral certainty.

## Acceptance criteria

<!-- All driven at 390×844 on the served page by taps on visible controls only; no test invokes game input hooks or mutates the outcome directly. -->

- AC-1: WHEN the courier taps Saint Orra's onward-carry control after the Episode 1 ending, THE served page SHALL present Maud Underbell at the Bell Archive with visible, separate name-choice controls.
- AC-2: WHEN the player taps the visible name choice matching the sealed stored name, THE served page SHALL show a visible bell-ring state and an Act II ending card saying the district light stays lit.
- AC-3: WHEN the player taps a visible name choice that does not match the sealed stored name, THE served page SHALL show a visible bell-ring state and an Act II ending card saying one district light goes out.
- AC-4: WHEN the bell has rung, THE game SHALL persist the completed outcome through the game's save service before any browser storage is cleared.
- AC-5: WHEN the player reopens the same saved slot in a fresh browser context after the outcome was saved and browser storage was cleared, THE served page SHALL show the same Act II ending card.
- AC-6: IF the ending card or any of Io, Orra, or Maud describes the handoff or name choice, THEN THE text SHALL name only the controls the player actually tapped.

## Out of scope

- Component names, selectors, save-schema fields, and dialogue wording — chosen by the test-first implementation, provided the served interaction and persistence contract above hold.
- Any Act II content beyond the bell and ending card.

## References

- Research: [docs/research/2598-bell-archive-name.md](../research/2598-bell-archive-name.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)
- Brief: [docs/flagship/BRIEF.md](../flagship/BRIEF.md) (M3 Bell Archive acceptance)

## Constitution check

- C1: pass — AFTERSIGN flagship story only.
- C2: pass — every AC is driven by taps on visible controls at 390×844; no input hooks.
- C3: pass — each AC maps to a served-page E2E test written before the build and failing on main.
- C4: pass — docs-only spec; consumed by the #2598 build, which ships on the served page.
- C5: pass — AC-6 forbids text describing choices the player did not tap.
- C6: pass — follows the research doc; ACs in EARS form; listed in docs/INDEX.md.
- C7: pass — checkable through CI and the deployed page; no device or human sign-off.
- C8: pass — scope limited to the bell and ending card to fit the M3 date.
