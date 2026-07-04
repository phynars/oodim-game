# Galaga formation-spawn cadence probe spec

## Problem

Galaga formation entry is a rhythm mechanic. A wave should stream enemies into the playfield on a stable fixed-tick cadence, then let them settle into the grid. If the delta between consecutive spawns drifts by more than a tick or two, the player reads the wave as arrhythmic even when each individual enemy follows the right curve.

This spec locks the cadence as a gameplay-feel invariant before the next engine churn. It is intentionally a probe/test slice, not a behavior-change slice.

## Current engine surface

`galaga/src/game/engine.ts` already anchors formation choreography to fixed-step simulation time:

- `formationStartTick` is set when gameplay starts or a new stage is armed.
- `formationTick = state.tick - formationStartTick` is passed into `this.enemies.tick(formationTick)` once per non-frozen playing update.
- stage advancement resets `formationStartTick` to `null` so the next stage re-anchors from zero.

`galaga/src/game/types.ts` already exposes test-only internals through `GalagaInternals`, including `fireProbe()`, `setInvulnerable()`, and banner/display probes. The formation cadence probe should follow that shape: read-only, test-only, and zero gameplay effect.

## Proposed probe

Add a test-only ring buffer to `GalagaInternals`:

```ts
export interface FormationSpawnProbeEntry {
  tick: number;
  formationTick: number;
  enemyId: number;
  slotIndex: number;
  x: number;
  y: number;
}
```

Expose it through:

```ts
formationSpawnProbe(): FormationSpawnProbeEntry[];
```

The engine records one entry on the tick an enemy first appears in the live public roster returned by `this.enemies.tick(formationTick)`. The probe should be derived from roster diffs, not by changing the enemy controller's schedule:

1. Keep a private `seenFormationEnemyIds: Set<number>` in `Engine`.
2. After `this.state.enemies = this.enemies.tick(formationTick)`, scan the returned roster.
3. For each enemy id not yet seen, push one probe entry.
4. Bound the buffer (for example, last 128 entries) so long test runs do not grow memory.
5. Clear `seenFormationEnemyIds` and the probe buffer when the controller resets for a new stage or when a challenging stage is forced.

`slotIndex` can be the index in the live roster at first appearance. If the controller exposes a better formation slot later, use that; the first probe should not require controller surgery.

## E2E acceptance check

Add `galaga/e2e/feel/formation-spawn-cadence.spec.ts`.

The spec should:

1. Start Galaga in test mode.
2. Advance until the first normal-stage entrance has produced a full wave sample.
3. Read `window.__galagaInternals.formationSpawnProbe()`.
4. Compute consecutive `tick` deltas.
5. Assert hard gates:
   - sample count equals the expected first-wave size,
   - median delta is greater than 0,
   - p99 absolute delta-from-median is `<= 1` tick,
   - max absolute delta-from-median is `<= 2` ticks.
6. Restart from the same seed/session path and assert the probe array is byte-identical.

The cadence gate should compare deltas to the median, not to a hard-coded designer delay. A future balance pass may choose a slower or faster uniform entrance rate; what must not regress is intra-wave jitter.

## Non-goals

- Do not change enemy spawn timing.
- Do not change entrance curves.
- Do not change formation grid layout.
- Do not add juice, particles, or copy.
- Do not use wall-clock time for the assertion; use engine ticks only.

## Done

The slice is done when CI has a deterministic feel spec that fails if consecutive formation entries jitter outside the tick envelope above, while gameplay output remains unchanged outside the read-only probe.
