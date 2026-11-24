# Spec — #3032 Act I end-card continuation into Act II

**Story:** #3032 · **Epic:** #3030 · **Research:** [Act I end-card continuation into Act II](../research/3032-act-i-end-card-act-ii-continuation.md)

## Problem

The current Episode 2 Act I ending card exposes a button labelled “Episode 2 — Act I ends current content”; it leads only to a current-content message. The saved story payload already preserves `nikoShortcutAnswer`, but no player-controlled Act II opening makes its `take` or `refuse` value visible after the ending card or after reload.

## Behaviour

At a 390×844 viewport, a player who reaches the Act I ending card sees a visible `Continue to Act II` control. Tapping that control opens Act II. The opening identifies either the `take` or `refuse` shortcut answer with distinct authored copy, a stable scene id, and its own visible next control. The selected opening and shortcut answer are persisted through the existing authoritative save path so a page reload restores the same Act II opening.

## Acceptance criteria

- AC-1: WHEN a player reaches the Act I ending card at a 390×844 viewport, THE served page SHALL show a visible `Continue to Act II` control that a pointer tap can activate.
- AC-2: WHEN a player taps `Continue to Act II` after the `take` shortcut answer, THE game SHALL display the `take` Act II opening with distinct authored text, a stable Act II scene id, and a visible next control.
- AC-3: WHEN a player taps `Continue to Act II` after the `refuse` shortcut answer, THE game SHALL display the `refuse` Act II opening with distinct authored text, a stable Act II scene id, and a visible next control.
- AC-4: WHEN the player reloads after entering either Act II opening, THE game SHALL restore the same Act II scene id and the authored opening corresponding to the persisted `take` or `refuse` shortcut answer.

## Out of scope

- New Act II narrative beyond the two opening cards and their next controls.
- Changes to shortcut-answer selection before the Act I ending card.
- Replacing the existing authoritative save architecture.
- Input through `window.__game`; it remains assertion-only.

## References

- Research: [Act I end-card continuation into Act II](../research/3032-act-i-end-card-act-ii-continuation.md)
- Architecture: [AFTERSIGN at a glance](../plan/architecture/README.md#aftersign-at-a-glance)

## Constitution check

- C1: pass — the scope is limited to the active AFTERSIGN flagship.
- C2: pass — AC-1 through AC-4 require visible controls operated by pointer tap at 390×844; tests use state only for assertions.
- C3: pass — the design maps every AC to a named test that must fail before the build change.
- C4: pass — each outcome is a visible served-page card, copy, and control.
- C5: pass — each opening names only the persisted `take` or `refuse` action the player took.
- C6: pass — this spec follows the research and supplies EARS acceptance criteria for the design and test stages.
- C7: pass — Playwright can verify every criterion through the served page and existing save service.
- C8: pass — the scope stops at the two opening cards rather than extending Act II.
