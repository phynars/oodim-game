# Spec — #2993 Episode 2 entry

**Issue:** [#3007](https://github.com/phynars/oodim-game/issues/3007) · **Story:** #2993 · **Epic:** #2579 · **Research:** [docs/research/2993-episode-two-entry.md](../research/2993-episode-two-entry.md)

## Problem

A player who reaches the Episode 1 end card needs an explicit completion state and a visible, phone-reachable control to choose the next episode. Starting Episode 2 must be a player action, not an automatic transition or a test-only state change.

## Behaviour

At 390×844, the served Episode 1 end card states that Episode 1 is complete and that Episode 2 is ready. The same card presents a visible **Begin Episode 2** control without requiring a swipe. When the player taps that control, the served panel enters the Episode 2 Night Post continuation; the Episode 1 controls are no longer shown.

## Acceptance criteria

- AC-1: WHILE the Episode 1 end card is shown at 390×844, THE served game SHALL show the exact completion message "Episode 1 complete. Episode 2 is ready."
- AC-2: WHILE the Episode 1 end card is shown at 390×844, THE served game SHALL show a visible "Begin Episode 2" control that the player can tap without a swipe.
- AC-3: WHEN the player taps the visible "Begin Episode 2" control, THE served game SHALL replace the Episode 1 end card with the Episode 2 Night Post continuation and SHALL not show Episode 1 controls.

## Out of scope

- Changing Episode 1 choices, ending copy other than the explicit completion message, or durable Unlit Door facts.
- Adding Episode 2 jobs, choices, progression, audio, or locations beyond the Night Post entry.
- Runtime implementation and test implementation; the later test and build stages own those changes.

## References

- Research: [docs/research/2993-episode-two-entry.md](../research/2993-episode-two-entry.md)
- Architecture: [docs/plan/architecture/README.md#act-iii-the-unlit-door-shipped](../plan/architecture/README.md#act-iii-the-unlit-door-shipped)
- Consuming build story: [#2993](https://github.com/phynars/oodim-game/issues/2993)

## Constitution check

- C1: pass — the specified surface is AFTERSIGN.
- C2: pass — AC-3 begins with a player tap on the visible control at the phone viewport; assertions may inspect state but never cause input.
- C3: pass — the design maps every acceptance criterion to an existing named served-page test; this documentation stage adds no test code.
- C4: pass — this docs-only stage specifies a served-page outcome for the consuming build story.
- C5: pass — the completion copy reports only episode status and does not claim an unmade player choice.
- C6: pass — this spec follows research and supplies EARS criteria for the design stage.
- C7: pass — each outcome is checkable in a served-page repository test at 390×844.
- C8: pass — scope ends at the Episode 2 Night Post entry.
