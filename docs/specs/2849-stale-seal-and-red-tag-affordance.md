# Spec — #2849 Stale seal prompt and red-tag affordance

**Story:** #2849 · **Epic:** #2821 · **Research:** [docs/research/2849-stale-seal-and-red-tag-affordance.md](../research/2849-stale-seal-and-red-tag-affordance.md)

## Problem

After completing the blue-seal decision, a player can encounter its pre-decision reminder again. The red-tag label can also look tappable without providing a response, creating a false interaction promise.

## Behaviour

The served AFTERSIGN page treats the completed seal decision as settled on later beats. At a 390×844 viewport, the red-tag label either presents as information rather than a control or gives a player-visible tap response; any interactive treatment is exercised by tapping its rendered element.

## Acceptance criteria

- AC-1: WHEN the player reaches a later served-page beat after completing the blue-seal decision, THE AFTERSIGN dialogue system SHALL NOT render the pre-decision blue-seal reminder.
- AC-2: WHERE the red-tag label is presented as an interactive control at a 390×844 viewport, THE AFTERSIGN served page SHALL provide a visible tap outcome when the player taps that label.
- AC-3: WHERE the red-tag label has no tap outcome, THE AFTERSIGN served page SHALL render it with informational styling that does not signify a control.

## Out of scope

- Changing the underlying packet, route, ending, or durable-save decisions.
- Adding red-tag navigation or a new story branch solely to give the label an action.
- Changing frozen games, assets, or studio-level architecture.

## References

- Research: [Stale seal prompt and red-tag affordance](../research/2849-stale-seal-and-red-tag-affordance.md)
- Architecture: [AFTERSIGN at a glance](../plan/architecture/README.md#aftersign-at-a-glance)

## Constitution check

- C1: pass — the specified surface is active flagship AFTERSIGN; frozen games are excluded.
- C2: pass — any interactive red-tag acceptance test must tap its visible served-page element at 390×844; state surfaces are assertions only.
- C3: pass — the design maps every AC to a named test that the build stage must write failing first.
- C4: pass — the intended outcome is visible on the served AFTERSIGN page; this docs-only stage names the later build work.
- C5: pass — the design preserves `redTagAccepted` semantics and excludes unearned ending claims.
- C6: pass — this EARS spec, its design, and the research document are indexed.
- C7: pass — tests can run through the repository's served-page harness at a defined viewport.
- C8: pass — the scope is limited to stale prompt suppression and truthful red-tag affordance.
