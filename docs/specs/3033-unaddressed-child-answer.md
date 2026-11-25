# Spec — #3033 Unaddressed Child answer

**Story:** #3033 · **Epic:** #3030 · **Research:** [docs/research/3033-unaddressed-child-answer.md](../research/3033-unaddressed-child-answer.md)

## Problem

This story proposes a player-visible, durable record of how the player answers the Unaddressed Child. Its build must make the ending and a restored slot truthfully name the answer the player selected.

## Behaviour

During the Act II route, the served dialogue panel asks the Unaddressed Child a question and shows two visible answer controls: **"I don't know."** and **"I know where to begin."** The player taps one control. The selected exact answer is saved with the slot, named on the Act II ending card, and named again after the same slot is restored in a fresh browser context.

## Acceptance criteria

- AC-1: WHEN the Act II Unaddressed Child question is shown, THE served AFTERSIGN page SHALL show visible controls labelled **"I don't know."** and **"I know where to begin."** that a player can tap at a 390×844 viewport.
- AC-2: WHEN the player taps either Unaddressed Child answer, THE game SHALL persist the corresponding exact answer as `story.unaddressedChildAnswer` in the authoritative slot save, leaving `story.nikoShortcutAnswer` (the Niko `take`/`refuse` choice) unchanged.
- AC-3: WHEN the player reaches the Act II ending after answering the Unaddressed Child, THE ending card SHALL name the exact answer the player tapped.
- AC-4: WHEN the same slot is opened in a fresh browser context after the player answered the Unaddressed Child, THE served AFTERSIGN page SHALL restore and display that slot's exact answer on its Act II ending card.

## Out of scope

- Altering the existing Act II ending decision or its other remembered facts.
- Adding a third answer, branching Act III, or changing the Unlit Door choice.
- Migrating existing slots that have no `story.unaddressedChildAnswer` value.
- Changing the Niko shortcut answer (`story.nikoShortcutAnswer`, values `take`/`refuse`) or the Act I end-card that reads it.

## References

- Research: [docs/research/3033-unaddressed-child-answer.md](../research/3033-unaddressed-child-answer.md)
- Architecture: [docs/plan/architecture/README.md#client-components](../plan/architecture/README.md#client-components)
- Build issue: #3033

## Constitution check

- C1: pass
- C2: pass — the build tests tap the two visible answer controls on the served page; `window.__game` is assertions only.
- C3: pass — each acceptance criterion maps to a named fail-to-pass test in the design.
- C4: pass — the specified outcome is visible on the served AFTERSIGN page.
- C5: pass — the ending repeats only the exact visible control the player tapped.
- C6: pass
- C7: pass — CI can verify the visible controls, saved field, ending text, and fresh-context restoration.
- C8: pass — the story limits itself to two answers and existing Act II ending presentation.
