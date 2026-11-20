# Spec — #2895 Episode 2 continuation from the Episode 1 end screen

**Story:** #2895 · **Epic:** #2893 · **Research:** [docs/research/2895-episode-two-continuation.md](../research/2895-episode-two-continuation.md)

## Problem

A player who completes Episode 1 has a durable ending but no explicit, player-controlled route from that end screen into Episode 2. A continuation must retain the door choice the player made rather than inventing a different outcome.

## Behaviour

At 390×844, the durable Episode 1 end screen shows a visible **Begin Episode 2** control alongside **Start fresh**. When the player taps **Begin Episode 2**, the served page replaces the Episode 1 end screen with the Night Post. Io's visible continuation line names only the selected Unlit Door choice. The continuation is saved, so a reload resumes at the Night Post rather than the Episode 1 end screen; Episode 1 controls are no longer available there.

## Acceptance criteria

- AC-1: WHILE the durable Episode 1 end screen is shown at 390×844, THE served game SHALL show a visible "Begin Episode 2" control that a player can tap without a swipe.
- AC-2: WHEN the player taps the visible "Begin Episode 2" control, THE served game SHALL replace the Episode 1 end screen with a Night Post continuation and SHALL not show Episode 1 controls.
- AC-3: WHEN the Night Post continuation is reached after the player taps "Begin Episode 2", THE served game SHALL show an Io line that names only the Unlit Door choice stored for that player.
- AC-4: WHEN a player reloads after tapping "Begin Episode 2", THE served game SHALL resume at the Night Post continuation with the stored Unlit Door choice and SHALL not return to the Episode 1 end screen.

## Out of scope

- Changing Unlit Door choices, their existing save format, or Episode 1 ending copy.
- Adding Episode 2 locations, choices, audio, or progression beyond the Night Post arrival.
- Implementing the served UI or tests; the build and test stages own those changes.

## References

- Research: [docs/research/2895-episode-two-continuation.md](../research/2895-episode-two-continuation.md)
- Architecture: [docs/plan/architecture/README.md#client-components](../plan/architecture/README.md#client-components)
- Consuming build story: [#2895](https://github.com/phynars/oodim-game/issues/2895)

## Constitution check

- C1: pass
- C2: pass — each transition begins with a tap on the visible `Begin Episode 2` control at the phone viewport; test assertions may inspect state but do not cause input.
- C3: pass — the design maps every acceptance criterion to a named served-page test that fails before build work.
- C4: pass — this docs-only stage specifies a served-page continuation for build story #2895.
- C5: pass — the Io line is constrained to the player's stored Unlit Door choice.
- C6: pass — this spec follows the research → spec → design sequence and uses EARS criteria.
- C7: pass — all outcomes are checkable by repository tests on the served page.
- C8: pass — scope ends at the Night Post arrival, not a larger Episode 2 arc.
