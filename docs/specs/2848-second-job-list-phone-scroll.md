# Spec — #2848 Phone scrolling for the second job list

**Story:** #2848 · **Epic:** #2821 · **Research:** [docs/research/2848-second-job-list-phone-scroll.md](../research/2848-second-job-list-phone-scroll.md)

## Problem

At a 390×844 phone viewport, the served second-job list clips its lower offers. A player needs to read “Night transfer”, scroll through the same visible list, and select “Signed receipt” without a test-only input path.

## Behaviour

On the served AFTERSIGN page, the second-job offer region keeps “Night transfer” fully readable at 390×844. The player can use touch or wheel input on that rendered region to reach “Signed receipt”, then tap its visible offer control to advance through the existing job-selection flow.

## Acceptance criteria

- AC-1: WHEN the served second-job list is rendered at a 390×844 viewport, THE AFTERSIGN page SHALL display the complete “Night transfer” offer within the visible job-list region.
- AC-2: WHEN the player scrolls the rendered second-job list by touch or wheel at a 390×844 viewport, THE AFTERSIGN page SHALL reveal the “Signed receipt” offer without a harness input path.
- AC-3: WHEN the player taps the visible “Signed receipt” offer after scrolling, THE AFTERSIGN page SHALL advance through the existing job-selection flow.

## Out of scope

- Changing the offered-job selection rules, labels, or durable player-history inputs in `computeOfferedJobs`.
- Creating a new job branch, changing packet, route, ending, or durable-save decisions.
- Changing frozen games, assets, browser-specific scrollbar styling, or studio-level architecture.

## References

- Research: [Phone scrolling for the second job list](../research/2848-second-job-list-phone-scroll.md)
- Architecture: [Client components](../plan/architecture/README.md#client-components)

## Constitution check

- C1: pass — the specified surface is active flagship AFTERSIGN; frozen games are excluded.
- C2: pass — the build-stage acceptance test will scroll and tap the visible served-page job-list controls at 390×844; `window.__game` is assertions only.
- C3: pass — the design maps every AC to a named test that the build stage must write failing first.
- C4: pass — the intended scroll and selection outcome is visible on the served AFTERSIGN page; this docs-only stage defines the later build work.
- C5: pass — the scope preserves the existing job-selection facts and does not author an unearned memory claim.
- C6: pass — this EARS spec, its design, and the research document are indexed.
- C7: pass — the served-page harness can exercise the viewport, wheel/pointer scroll, and visible offer tap through the repository.
- C8: pass — scope is limited to making the existing second-job list readable, scrollable, and selectable on a phone viewport.
