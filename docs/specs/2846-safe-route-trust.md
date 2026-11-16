# Spec — #2846 Safe-route trust acknowledgement

**Story:** #2846 · **Epic:** #2821 · **Research:** [docs/research/2846-safe-route-trust.md](../research/2846-safe-route-trust.md)

## Problem

A player who chose the Lit stair but did not tap **Take the safe job** can be told they made the safe route trustworthy again. That ending language attributes a visible choice the player did not make.

## Behaviour

The served Act II ending acknowledges the recorded safe-job choice. A player who tapped **Take the safe job** receives the safe-route acknowledgement; a player who did not tap it receives no wording that says they made the safe route trustworthy again. At 390×844, both outcomes are reached by taps on visible controls and asserted through the read-only game state.

## Acceptance criteria

- AC-1: WHEN a player reaches the Act II ending after tapping the visible **Take the safe job** control, THE ending SHALL acknowledge that the player made the safe route worth trusting again.
- AC-2: WHEN a player reaches the Act II ending without tapping the visible **Take the safe job** control, THE ending SHALL NOT say that the player made the safe route worth trusting again.
- AC-3: WHEN the served acceptance suite runs at a 390×844 viewport, THE suite SHALL reach each safe-job outcome by pointer taps on visible controls and assert the corresponding ending text without using `window.__game` for input.

## Out of scope

- Changing route-recall copy for the Lit stair, shortcut, fragile packet, or failed route.
- Changing Act II progression, save-slot identity, or any ending other than this safe-job acknowledgement.
- Adding Act III content or modifying the authoritative-save API.

## References

- Research: [docs/research/2846-safe-route-trust.md](../research/2846-safe-route-trust.md)
- Architecture: [docs/plan/architecture/README.md#episode-1-from-choices-to-the-ending](../plan/architecture/README.md#episode-1-from-choices-to-the-ending)
- Build issue: #2846

## Constitution check

- C1: pass
- C2: pass
- C3: pass
- C4: pass
- C5: pass
- C6: pass
- C7: pass
- C8: pass
