# Galaga formation-spawn cadence — feel-audit spec (Ivy)

> **Status:** SPEC — describes a probe + merge-gate that does not yet exist
> in the engine. This doc is a `Refs` placeholder for the issue that will
> request the probe wiring; no behavior change lands with this doc.
>
> **Author:** Ivy Tran (gameplay-feel quality bar). Mirrors the additive
> test-surface pattern that landed for #168 (`fireProbe`) and #210
> (`dirCommitProbe`) — one engine ring buffer + one e2e spec + zero
> behavior change.

---

## Why this exists

Galaga's enemies enter the playfield in formation waves: a column or arc
streams in along a curved path, then settles into a slot in the grid. The
moment a wave begins is a major feel beat — it sets the rhythm of the
round.

If the cadence between successive enemy spawns within a wave **drifts** —
because the spawn scheduler ticks on a wall-clock budget instead of the
sim's fixed tick, or because the per-wave delay table rounds floats
inconsistently — players feel arrhythmia even if they can't name it. Same
failure mode as #137 (ghost interpolation): the eye reads the
delta-between-events, not any single event.

This audit is **prior to** any observed bug. The goal is to lock the
cadence as a merge-gated invariant **before** the multiplayer rung churns
the loop. No probe currently exists for enemy-spawn timing — closest is
#168's `fireProbe`, which captures the player-projectile path, not enemy
formation entry. Highest-leverage Galaga gap as of 23696df.

## Acceptance shape (for the future issue)

The PR that closes the future issue will:

1. **Add the probe.** `galaga/src/game/engine.ts` exposes a test-only
   ring buffer `formationSpawnProbe` on `GalagaInternals` (mirror
   `fireProbe` shape). Each entry:
   ```
   { tick: number, waveId: number, slotIndex: number, x: number, y: number }
   ```
   Pushed on the exact tick an enemy is created in the live formation.
   Bounded buffer (size 64 — one full wave fits, oldest drops).

2. **Add the spec.** New
   `galaga/e2e/feel/formation-spawn-cadence.spec.ts` drives a single
   full wave from a known seed, reads `formationSpawnProbe`, computes
   the inter-spawn tick delta per consecutive pair, and asserts:

   - **Hard gate (CI-blocking):**
     `expect(p99(|delta - median(delta)|)).toBeLessThanOrEqual(1)`  // ticks
     `expect(max(delta)).toBeLessThanOrEqual(median(delta) + 2)`
   - **Soft (non-gating, via `expect.soft`):**
     `soft(median(delta) > 0)`
     `soft(probe.length === expectedWaveSize)`

3. **Determinism guard.** Running the spec twice from the same seed
   produces byte-identical probe arrays (mirror #210 dir-commit
   determinism guard). One `expect.deepEqual` on a re-run array, no
   tolerance.

4. **Scope guard.** Zero changes to spawn behavior. The only engine
   diff is the probe push at the existing spawn site. If the spec fails
   on HEAD, that's a feel bug — filed as a follow-up, not patched in
   the same PR.

## Why delta-from-median, not absolute delta

Integer fixed-tick sim means uniform schedule rebalances (designer
work — slowing or speeding all waves) don't break the gate, but
**arrhythmia** does. Cf. memory: "Frame-time feel-specs under
SwiftShader CI: gate on ONE generous absolute p99 ceiling (hard);
soft() all shape ratios + target bars." Tick-delta is integer-precise
on the fixed-tick sim, so the gate stays tight (≤ 1 tick p99 around
the median) without coupling to the absolute schedule.

## Explicit non-goals

- Do **not** change the spawn schedule, the curve interpolation, the
  wave composition, or any timing constant.
- Do **not** rework the formation grid layout.
- Do **not** add visual juice (Diego's lane — separate issue if cadence
  audit surfaces a beat that wants a flash).
- Do **not** touch player-projectile or hit-detection paths (#168
  covers that axis).

## Prior art

- **#168** Galaga `fireProbe` + spec — additive test-surface pattern,
  hard gate on absolute p99, soft on shape. Shipped at 0f8380c.
- **#210** Pac-Man `dirCommitProbe` + spec — input-to-state-commit
  latency, same shape. Shipped at b145cac.
- **#237** Doom mouselook `frameProbe` — frame-time p99 ≤ 16.7ms,
  same harness pattern.
- **#224** Pac-Man emerge envelope (`emergeProgress`) — DATA-layer
  feel invariant locked by `ghost-emerge.spec.ts`. Renderer-pixel
  continuity at the `p=1` flip remains unasserted; tracked in
  workspace draft `pacman-emerge-envelope-continuity.md`.

This issue is the formation-entry analog: same shape, new mechanic.

## Filing plan

Filed as a `by:ivy` issue (type=enhancement, loe=S, priority=P2) the
moment my open-issue cap (3/3) frees. Currently blocked behind #168
(close-requested, stuck `agent-unroutable`) and #137 (close-requested
2026-06-23). Tracking draft in workspace at
`drafts/galaga-formation-respawn-timing.md`.

## Companion drafts (queued behind the cap)

- `drafts/galaga-formation-respawn-timing.md` — the issue body that
  will reference this doc when filed.
- `drafts/pacman-emerge-envelope-continuity.md` — renderer-layer
  follow-up to #224; asserts no sub-pixel jump in `renderGhosts` at
  the `emergeProgress === 1` settled-branch flip. NOT obsoleted by
  #224's data-layer spec; different layer.
- `drafts/pacman-frightened-transition-frame.md` — fills the gap in
  #145's steady-state-only frightened spec by sampling the transition
  frame itself.
