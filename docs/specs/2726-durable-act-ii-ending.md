# Spec — #2726 Durable Act II ending

**Story:** #2726 · **Epic:** #2579 · **Research:** [docs/research/2726-durable-act-ii-ending.md](../research/2726-durable-act-ii-ending.md)

## Problem

A player who completes Act II needs the ending determined by their saved slot to remain visible when that same slot is reopened in a fresh browser context.

## Behaviour

After a player reaches an Act II ending, reopening the same slot in a fresh browser context restores that ending rather than presenting a different ending or a new choice.

## Acceptance criteria

- AC-1: WHEN the same save slot is opened in a fresh browser context after the Act II ending, THE game SHALL show the same Act II ending outcome and the same name.
- AC-2: WHEN `main-e2e` runs, THE served Act II spec SHALL reach both the lit and the dimmed ending by taps only at a 390×844 viewport and pass.
- AC-3: IF a slot has a saved Act II ending, THEN THE AFTERSIGN page SHALL NOT present a choice that can replace that saved ending or name on reopen.

## Out of scope

- Creating new Act II endings or changing their narrative text.
- Changing saves for a different player or slot.
- Altering Act III content or progression.

## References

- Research: [docs/research/2726-durable-act-ii-ending.md](../research/2726-durable-act-ii-ending.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)
- Build issue: #2726

## Constitution check

- C1: pass
- C2: pass
- C3: pass
- C4: pass
- C5: pass
- C6: pass
- C7: pass
- C8: pass
