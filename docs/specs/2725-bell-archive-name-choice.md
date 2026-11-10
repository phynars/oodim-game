# Spec — #2725 Bell Archive name choice

**Story:** #2725 · **Epic:** #2587 · **Research:** [docs/research/2725-bell-archive-name-choice.md](../research/2725-bell-archive-name-choice.md)

## Problem

After Orra's line, the player needs a visible, tappable route to Maud Underbell at the Bell Archive, where a remembered name determines a truthful Act II ending.

## Behaviour

At a 390×844 viewport, the player taps the visible control following Orra's line. The game presents Maud Underbell at the Bell Archive with name choices the player can tap. Choosing the name stored from Orra rings the bell and leaves the district light lit; choosing another offered name rings the bell and dims one district light. Maud's dialogue and the ending card use only the name choice the player tapped.

## Acceptance criteria

- AC-1: WHEN the player taps the visible control after Orra's line at a 390×844 viewport, THE game SHALL show Maud Underbell at the Bell Archive with tappable name choices.
- AC-2: WHEN the player taps a name that matches the stored Orra memory, THE game SHALL ring the bell and show an Act II ending card with the district light still lit.
- AC-3: WHEN the player taps a name that does not match the stored Orra memory, THE game SHALL ring the bell and show an Act II ending card with one district light out.
- AC-4: WHEN the player reaches Maud's dialogue or the Act II ending card after tapping a name choice, THE game SHALL name only the choice the player actually tapped.

## Out of scope

- Changing Orra's memory-writing flow or its stored name.
- Adding Bell Archive outcomes beyond the matching and non-matching name choices.
- Changing unrelated acts, districts, or game surfaces.

## References

- Research: [Bell Archive name choice](../research/2725-bell-archive-name-choice.md)
- Architecture: [AFTERSIGN architecture](../plan/architecture/README.md)
- Story: [#2725](https://github.com/phynars/oodim-game/issues/2725)

## Constitution check

- C1: pass — the scope is limited to the AFTERSIGN Bell Archive story and names no frozen game.
- C2: pass — acceptance uses visible player controls at 390×844 and reserves state access for assertions.
- C3: pass — the design assigns a named, player-driven test to each criterion; tests are proposed only and not included in this documentation change.
- C4: pass — the future implementation targets the served AFTERSIGN page; this documentation-only change is not a served-surface change.
- C5: pass — dialogue and ending copy are constrained to the player's tapped choice.
- C6: pass — this spec follows the research → spec → design sequence and is indexed.
- C7: pass — the planned tests can verify the visible flow through repository tests and the served page.
- C8: pass — scope is limited to the stated Bell Archive choice and ending outcomes.
