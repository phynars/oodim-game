# Doom — enemy DEATH amplification (juice spec, #194)

Companion to `juice-enemy-hit-spec.md` (#166). That doc owns the
universal "I CONNECTED" beat: 2-frame hitstop, 6-tick body flash,
6 orange impact sparks, half-amplitude connect-shake, non-lethal
flinch knock. This doc owns the kill-only "I KILLED" layer that
stacks ON TOP of that beat when `hp` falls to 0.

Tone target: pacman=graceful, galaga=punchy, **doom=HEAVY**. A kill
should land in the player's sternum: 100ms world-stop, then a heavy
shake, then dark red rain falling fast, then the body holding on the
floor for 400ms before dissolving.

## What exists today (engine.ts at commit 9693b6b)

The lethal branch of `damageEnemy` (engine.ts ~line 1072):

- flips `e.state = 'dead'`, awards `SCORE_BY_KIND[e.kind]`
- calls `playEnemyDeath()` — longer pitched-down groan (audio.ts:173)
- swaps the rig's active clip to `death` via `setActiveClip`
- the body flash + global hitstop + connect-shake + 6 orange sparks
  all fire via the inherited `applyHitJuice(...)` path with
  `willKill=true` (the only branch `willKill` changes is suppressing
  the flinch knock — sparks/flash/shake/hitstop are SHARED with grazes)
- the dead enemy is culled on the NEXT tick by the death-cull block
  at the end of `update()` (engine.ts ~line 1108), disposing mesh +
  rig

Net felt result: the kill is *identical* to a graze except the rig
plays its one-shot `death` clip for ~16ms before disposal. The
killing blow does not feel heavy.

## What ships with #194

Four layers, all stacked on top of #166's inherited beat:

### A. Heavy kill-hitstop (replaces the 2-frame inherited freeze)

```ts
KILL_HITSTOP_TICKS = 6      // 100ms — 3× the non-lethal HITSTOP_TICKS_ON_HIT (2)
```

In `damageEnemy`'s lethal branch:

```ts
this.state.hitstopTicks = Math.max(this.state.hitstopTicks, KILL_HITSTOP_TICKS);
```

`Math.max`, never `+=` — past Galaga learning (memory: hitstop in
mass-kill paths MUST clamp, not accumulate, or `forceHit` loops freeze
the engine). The existing hitstop gate at the top of `update()`
already short-circuits the sim during the freeze; no new wiring.

### B. Kill-shake — a third shake channel parallel to damage + connect

Three semantically-distinct shake channels live on `DoomState` after
#194:

| Channel              | Meaning                | Ticks | Amplitude |
|----------------------|------------------------|-------|-----------|
| `shakeTicks`         | "I took damage" (#91)  | 12    | 1.0×      |
| `hitShakeTicks`      | "I connected" (#166)   | 8     | 0.5×      |
| `killShakeTicks` NEW | "I killed" (#194)      | 14    | 1.6×      |

```ts
KILL_SHAKE_TICKS = 14                  // ~233ms
KILL_SHAKE_AMPLITUDE_FACTOR = 1.6      // largest of the three — kill is the loudest beat
```

State surface addition (`types.ts`):

```ts
interface DoomState {
  // ...existing
  killShakeTicks: number;  // init 0
}
```

`damageEnemy` lethal branch:

```ts
this.state.killShakeTicks = Math.max(this.state.killShakeTicks, KILL_SHAKE_TICKS);
```

Decay in the `!frozen` block of `update()` alongside the other shake
channels. Renderer in `syncCamera`, after the connect-shake offset
block:

```ts
if (this.state.killShakeTicks > 0) {
  const k3 = this.state.killShakeTicks / KILL_SHAKE_TICKS;
  // Exponential decay envelope (k3²) — sharp punch up front, settles fast.
  // The non-lethal hit is LINEAR k; the kill is QUADRATIC so the felt
  // ramp is steeper near the front, then drops away — a thud, not a wobble.
  const env = k3 * k3;
  const phase3 = this.state.tick;
  ox += Math.sin(phase3 * 1.3) * SHAKE_AMPLITUDE * KILL_SHAKE_AMPLITUDE_FACTOR * env;
  oy += Math.cos(phase3 * 1.7) * SHAKE_AMPLITUDE * KILL_SHAKE_AMPLITUDE_FACTOR * env;
}
```

Phase frequencies (1.3, 1.7) are distinct from damage (1.7/2.3) and
connect (2.1/1.9) so when all three fire on the same tick — possible
if the player kills an enemy while taking melee damage — the three
sinusoids don't beat-frequency cancel into stillness.

### C. Blood spray — kill-only, distinct from impact sparks

Sparks (#166) are universal — every hit, fatal or not, spawns 6
weightless orange chips that pop against the corridor. Blood is
kill-only and speaks a different visual language: dark red, heavier,
slower, more numerous, gravity-driven.

```ts
BLOOD_DROP_COUNT      = 14         // burst size (vs 6 sparks)
BLOOD_DROP_LIFETIME   = 32         // ~533ms (vs 18 sparks)
BLOOD_DROP_SPEED      = 0.05       // ~62% of spark base velocity (0.08)
BLOOD_DROP_GRAVITY    = 0.012      // 2.4× spark gravity (0.005) — falls fast
BLOOD_DROP_SIZE       = 0.06       // 50% larger than sparks (0.04)
BLOOD_DROP_COLOR      = 0x882222   // dark blood red
```

`DoomState` surface:

```ts
interface BloodDrop {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  ticksLeft: number;
}
state.bloodDrops: BloodDrop[]   // init []
```

Spawn site is `damageEnemy` lethal branch directly — NOT
`applyHitJuice`. Sparks belong in `applyHitJuice` because they fire on
every hit; blood belongs in the lethal branch because it fires only
on kills.

```ts
private spawnBloodSpray(point: THREE.Vector3): void {
  // 14 fixed jitter dirs on the upper hemisphere — weighted UP+OUT
  // (never straight-down; gravity will handle the fall). Deterministic
  // (no Math.random), same table-driven pattern as JITTER in
  // spawnImpactSparks. Velocities have a positive vy bias so drops
  // arc up before gravity pulls them down — reads as a spray, not
  // a splat.
  const JITTER: ReadonlyArray<readonly [number, number, number]> = [
    [ 0.7,  0.5,  0.3], [-0.7,  0.5,  0.3],
    [ 0.3,  0.5,  0.7], [-0.3,  0.5,  0.7],
    [ 0.7,  0.5, -0.3], [-0.7,  0.5, -0.3],
    [ 0.3,  0.5, -0.7], [-0.3,  0.5, -0.7],
    [ 0.5,  0.8,  0.0], [-0.5,  0.8,  0.0],
    [ 0.0,  0.8,  0.5], [ 0.0,  0.8, -0.5],
    [ 0.4,  0.3,  0.4], [-0.4,  0.3, -0.4],
  ];
  const n = Math.min(BLOOD_DROP_COUNT, JITTER.length);
  for (let i = 0; i < n; i++) {
    const j = JITTER[i];
    this.state.bloodDrops.push({
      x: point.x, y: point.y, z: point.z,
      vx: j[0] * BLOOD_DROP_SPEED,
      vy: j[1] * BLOOD_DROP_SPEED,
      vz: j[2] * BLOOD_DROP_SPEED,
      ticksLeft: BLOOD_DROP_LIFETIME,
    });
  }
}
```

Per-tick step (mirrors `stepImpactSparks`, gated on `!frozen`):

```ts
private stepBloodDrops(): void {
  if (this.state.bloodDrops.length === 0) return;
  const survivors: DoomState['bloodDrops'] = [];
  let pruned = false;
  for (const d of this.state.bloodDrops) {
    d.x += d.vx; d.y += d.vy; d.z += d.vz;
    d.vy -= BLOOD_DROP_GRAVITY;
    d.ticksLeft -= 1;
    if (d.ticksLeft <= 0) { pruned = true; continue; }
    survivors.push(d);
  }
  if (pruned) this.state.bloodDrops = survivors;
}
```

Renderer mirrors `syncImpactSparkMeshes` as `syncBloodDropMeshes`:

- shared `bloodGeometry = new THREE.SphereGeometry(BLOOD_DROP_SIZE, 6, 6)`
- shared `bloodMaterial = new THREE.MeshBasicMaterial({ color: BLOOD_DROP_COLOR, fog: false })`
- pool grows on demand, visible toggled, scale shrinks `d.ticksLeft / BLOOD_DROP_LIFETIME` (linear, same as sparks)

### D. Corpse beat — hold the death-clip pose, then fade

Today: dead enemy culled on the tick AFTER death. Net visible corpse:
~16ms. That is not a beat.

After #194: count-UP `deathTicks` counter per enemy (proven pattern
from Pacman #171 + #183). Cull when the counter reaches
`CORPSE_HOLD_TICKS`. Renderer fades opacity over the last
`CORPSE_HOLD_TICKS - CORPSE_FADE_START_TICK` ticks.

```ts
CORPSE_HOLD_TICKS       = 24    // 400ms total
CORPSE_FADE_START_TICK  = 12    // last 12 ticks fade alpha 1→0
```

`Enemy` type addition:

```ts
interface Enemy {
  // ...existing
  deathTicks?: number;  // undefined while alive; 0 the tick they die
}
```

`damageEnemy` lethal branch:

```ts
e.deathTicks = 0;
```

Cull block at end of `update()` (replaces the unconditional cull):

```ts
for (const e of this.state.enemies) {
  if (e.state !== 'dead') continue;
  e.deathTicks = (e.deathTicks ?? 0) + 1;
}
this.state.enemies = this.state.enemies.filter((e) => {
  if (e.state !== 'dead') return true;
  if ((e.deathTicks ?? 0) < CORPSE_HOLD_TICKS) return true;
  // Past hold — dispose mesh + rig and drop
  const model = this.enemyMeshes.get(e.id);
  if (model) {
    this.scene.remove(model);
    disposeEnemyModel(model);
    this.enemyMeshes.delete(e.id);
  }
  const rig = this.enemyRigs.get(e.id);
  if (rig) {
    rig.mixer.stopAllAction();
    rig.mixer.uncacheRoot(rig.mixer.getRoot());
    this.enemyRigs.delete(e.id);
  }
  return false;
});
```

The `deathTicks` increment happens INSIDE the existing `!frozen`
gate so the corpse beat pauses during the kill-hitstop freeze (same
principle as decay-during-freeze collapses the effect visually).

Renderer in the per-enemy loop in `render()`, after the existing
hit-flash apply:

```ts
if (e.state === 'dead' && mesh) {
  const t = e.deathTicks ?? 0;
  if (t > CORPSE_FADE_START_TICK) {
    const fade = 1 - (t - CORPSE_FADE_START_TICK) / (CORPSE_HOLD_TICKS - CORPSE_FADE_START_TICK);
    mesh.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      m.transparent = true;
      m.opacity = Math.max(0, fade);
    });
  }
}
```

Doom enemies are built from `MeshStandardMaterial` (see models.ts) so
opacity works without material swaps.

### E. Audio coupling — verify, don't add

`playEnemyDeath()` already fires at the kill instant (engine.ts:1078).
Confirm no change needed: the groan starts on the same tick the
freeze begins, locking audio to the visual. Resist adding a second
SFX — one groan layered over the existing `playEnemyHit()` ping
already gives the killing blow two aurally-distinct events.

## Determinism contract

Every new code path stays inside the existing fixed-step determinism
rules:

- No `Math.random` — blood jitter is a fixed table, like spark JITTER
- No wall-clock reads in the sim path — opacity fade uses `deathTicks`
  (fixed-step counter), not `THREE.Clock`
- All state mutations through the published `DoomState` contract — no
  hidden side-channels
- Hitstop gate respects every new channel: `bloodDrops` step, kill
  shake decay, and `deathTicks` increment all gate on `!frozen`

## Acceptance check (mechanical)

The e2e harness in `doom/e2e/enemy-death.spec.ts` should add
assertions for, after a single lethal `forceHit()`:

1. `state.hitstopTicks === 6` (was 2)
2. `state.killShakeTicks === 14` (new field present)
3. `state.bloodDrops.length === 14` (was 0)
4. `state.enemies[killedIdx].state === 'dead'`
5. `state.enemies[killedIdx].deathTicks === 0`

After advancing 24 fixed-step ticks (no hitstop now):

6. The killed enemy is removed from `state.enemies`
7. `state.bloodDrops.length` is 0 (32 - 24 = 8 ticks survived earlier
   — actually some drops still alive at 24; tighten to `length < 14`)
8. The mesh + rig were disposed (verifiable via `__doomModels.list()`
   not containing the killed enemy id)

Non-lethal hit regression guard (decrement hp by less than current hp):

9. `state.bloodDrops.length === 0` (kill-only path didn't fire)
10. `state.killShakeTicks === 0`
11. Sparks still spawn 6 orange chips per #166's existing tests

## Tone summary

The kill should feel like a *thud you feel in your sternum*:

1. **t=0**: world freezes (6-frame hitstop), `playEnemyDeath()` groan
   starts, body flash peaks white, 14 dark-red drops eject upward +
   outward at the enemy center, 6 orange sparks fire (inherited from
   #166)
2. **t=6**: sim unfreezes, kill-shake at peak amplitude (env=1.0),
   blood begins to fall (gravity 0.012/tick), corpse holds death-clip
   pose
3. **t≈20**: kill-shake half-decayed (env=0.18 by then via k²),
   blood scatter at floor level
4. **t=12-24**: corpse opacity linearly fades 1→0
5. **t=24**: corpse disposed, kill-shake done (k³=0 at 14 anyway),
   last few blood drops still expiring on the floor

Sparks = "I connected". Blood = "I killed". Two visual languages
reinforcing one beat. The corpse beat keeps the body present long
enough that the player REGISTERS the kill, not just inputs it.
