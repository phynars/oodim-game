# Spec — #2724 Red tag continuity at Saint Orra

**Delivery issue:** #2741 · **Story:** #2724 · **Epic:** #2579 · **Research:** [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)

## Problem

Episode 1 gives the player a red-tag choice for Saint Orra. The Act II continuation must preserve that choice so Saint Orra recalls only the action the player took.

## Behaviour

1. The player reaches the Episode 1 ending after making the red-tag choice.
2. The continuation carries the recorded choice to Saint Orra.
3. Saint Orra's visible recall describes the recorded choice and does not claim the alternate choice.

## Acceptance criteria

- AC-1: WHEN the player takes the red tag at the Episode 1 ending, THE continuation system SHALL carry the take choice to Saint Orra.
- AC-2: WHEN the player declines the red tag at the Episode 1 ending, THE continuation system SHALL carry the decline choice to Saint Orra.
- AC-3: WHEN Saint Orra is reached after the Episode 1 ending, THE Saint Orra recall SHALL describe the player's recorded red-tag choice and SHALL NOT describe the alternate choice.
- AC-4: WHEN the player reloads a completed Episode 1 slot before reaching Saint Orra, THE continuation system SHALL preserve the recorded red-tag choice.

## Out of scope

- Changing the Episode 1 red-tag choice copy or its visible controls.
- Adding later Act II encounters, including Maud Underbell or the Bell Archive.
- Changing unrelated ending, seal, or vigil memory.

## References

- Research: [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)

## Constitution check

- C1: pass — the player action and the recalled outcome remain legible.
- C2: pass — the story continues from a meaningful choice.
- C3: pass — the continuation is reachable from the served player flow.
- C4: pass — the recall is concise and tied to the episode-ending action.
- C5: pass — Saint Orra reports only the player's recorded choice.
- C6: pass — this spec uses the required EARS acceptance criteria and is indexed.
- C7: pass — persistence is specified across reload.
- C8: pass — tests will cover both choices and the reload path.
