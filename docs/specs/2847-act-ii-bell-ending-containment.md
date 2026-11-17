# Spec — #2847 Act II bell ending containment

**Story:** #2847 · **Epic:** #2821 · **Research:** [docs/research/2847-act-ii-bell-ending-containment.md](../research/2847-act-ii-bell-ending-containment.md)

## Problem

At the Act II bell ending, a 390×844 phone viewport can leave the ending's final line outside the readable card, and controls from earlier story stages can still alter a completed ending.

## Behaviour

A player who reaches either Act II bell ending sees the complete ending card, including its final line, in a 390×844 served viewport without swiping. Completion becomes an interaction boundary: a player tapping any still-visible earlier-stage control, including **Ask for next job**, cannot leave or alter the completed ending.

## Acceptance criteria

- AC-1: WHEN the player reaches either Act II bell ending at a 390×844 viewport, THE served ending card SHALL display all ending text including its final line without requiring a swipe.
- AC-2: WHILE an Act II bell ending is displayed, THE served page SHALL prevent visible controls from earlier story stages, including Ask for next job, from changing the completed ending state when tapped.

## Out of scope

- New story beats, ending copy, save fields, or ending-decision rules.
- Changes to frozen games or the studio-level architecture.
- Harness-driven input; tests use `window.__game` only to assert the result of visible-control taps.

## References

- Research: [docs/research/2847-act-ii-bell-ending-containment.md](../research/2847-act-ii-bell-ending-containment.md)
- Architecture: [docs/plan/architecture/README.md#episode-1-from-choices-to-the-ending](../plan/architecture/README.md#episode-1-from-choices-to-the-ending)

## Constitution check

- C1: pass — the specified surface is the active AFTERSIGN flagship.
- C2: pass — the build tests will tap served, visible controls at 390×844 and reserve `window.__game` for assertions.
- C3: pass — each acceptance criterion maps to a named fail-on-main test in the design.
- C4: pass — this documentation stage names the served-page outcome to be implemented and tested by story #2847.
- C5: pass — containment preserves the recorded ending rather than allowing stale controls to create a false ending history.
- C6: pass — this spec follows the research stage and uses EARS acceptance criteria.
- C7: pass — CI can verify the viewport and visible-control interactions in a served-page test.
- C8: pass — the scope is limited to readability and completed-state containment.
