# Galaga formation spawn cadence feel audit

## Status

Audit note prepared by Ivy. This is not a behavior change; it defines the merge-gated probe/test slice needed to lock Galaga enemy entrance rhythm.

## Problem

Galaga's enemy roster is emitted from the engine each fixed-step through the formation choreography. `galaga/src/game/engine.ts` anchors `formationStartTick` when play starts, computes `formationTick = state.tick - formationStartTick`, and assigns `state.enemies = this.enemies.tick(formationTick)`. The same update path is skipped during hitstop and stage-clear tally gates, so visible enemy entrance cadence is a feel-critical fixed-step contract.

There is already a Galaga input-latency probe (`fireProbe`) exposed through `window.__galagaInternals`, but there is no equivalent probe for the cadence at which formation enemies first become visible. Without that probe, a future change can make the delta between consecutive entrance spawns drift without tripping CI.

## Proposed additive probe

Add a test-only ring buffer to `GalagaInternals` that records each enemy id the first tick it appears in `state.enemies` during formation entry.

Suggested shape:

```ts
export interface FormationSpawnSample {
  tick: number;
  formationTick: number;
  enemyId: number;
  kind: EnemyKind;
  state: EnemyState;
}
```

Suggested internals accessor:

```ts
formationSpawnProbe(): FormationSpawnSample[];
```

Engine-side implementation should be additive only:

- Keep a private `seenFormationEnemyIds = new Set<number>()`.
- Keep a private `formationSpawnSamples: FormationSpawnSample[] = []`.
- After `this.state.enemies = this.enemies.tick(formationTick)`, scan the visible enemies once.
- For any enemy id not yet seen, record `{ tick: this.state.tick, formationTick, enemyId: e.id, kind: e.kind, state: e.state }`.
- Reset the set + samples whenever a new formation is anchored (`formationStartTick` transitions from `null`) so the probe captures the current wave/stage cleanly.
- Return a shallow copy from `formationSpawnProbe()` so tests cannot mutate engine state.

## Acceptance check

Add `galaga/e2e/feel/formation-spawn-cadence.spec.ts` that:

1. Starts Galaga from READY into PLAYING.
2. Waits Galaga until the probe has captured a representative current-wave sample set.
3. Reads `formationSpawnProbe()` twice from the same deterministic start path and expects byte-identical arrays.
4. Sorts samples by `(formationTick, enemyId)` and computes consecutive `formationTick` deltas.
5. Gates cadence drift with hard assertions:
   - p99 absolute delta-from-median <= 1 tick.
   - max absolute delta-from-median <= 2 ticks.
   - no duplicate `enemyId` samples in one probe window.
6. Keeps shape diagnostics soft where CI/browser timing may vary, such as total sample count thresholds.

## Scope guard

Do not change enemy scheduling, paths, scoring, firing, collision, hitstop, stage-clear tally, or renderer behavior. The engine touch is probe-only; if HEAD fails the cadence spec, file the behavior fix separately.

## Code evidence from this audit

- `galaga/src/game/engine.ts` computes formation cadence from `formationStartTick`, `state.tick`, and `this.enemies.tick(formationTick)` inside the fixed-step `update()` path.
- `galaga/src/game/engine.ts` exposes `fireProbe()` through `window.__galagaInternals`, giving the exact pattern for a test-only feel probe.
- `galaga/src/game/types.ts` defines `FireProbe` and `GalagaInternals.fireProbe()`, but has no formation-spawn cadence probe shape yet.
