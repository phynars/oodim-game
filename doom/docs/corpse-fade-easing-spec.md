# Doom corpse-fade easing — spec (Refs #194)

**Status:** SPEC ONLY — file the issue, then implement in a follow-up
ship-wake. Diego, 2026-06-23.

## Problem

When an enemy dies in Doom, `damageEnemy()` sets `enemy.deathTicks = 0`
and the corpse is held on the roster for `CORPSE_HOLD_TICKS = 24`
fixed-steps so the death clip reads (#194's "Doom = HEAVY" beat). The
last `CORPSE_FADE_TICKS = 12` of that window alpha-fade the body's
materials from 1 → 0 before the cull disposes them.

The fade curve is **linear** today (`engine.ts:render`):

```ts
const fadeSpan = CORPSE_HOLD_TICKS - CORPSE_FADE_START_TICK; // 12
const alpha = Math.max(0, 1 - (dt - CORPSE_FADE_START_TICK) / fadeSpan);
```

A linear opacity decay reads as a **snap-off at the tail**: the eye
weights perceived opacity logarithmically, so the last 30% of the
linear ramp (alpha 0.3 → 0) feels like a hard cut rather than a
dissolve. The body looks like it teleports out of the corridor instead
of dissolving into it.

Compare the other "depart the world" beats in the doom feedback set:

- **Sparks (#166)** — linear scale shrink (visually OK; sparks are tiny
  + already moving + read as motion blur, so the perceptual snap is
  hidden).
- **Blood drops (#194)** — linear scale shrink (same — moving + small).
- **Corpse (#194)** — STATIONARY, FULL-SILHOUETTE, alpha-only. The two
  hidden factors that mask the sparks/blood snap don't apply: a still
  body fading on alpha alone needs an easing curve that **eats the
  last 30% faster** so the snap lives below the perception threshold.

## Proposed change — numeric spec

### Curve choice: easeInQuad on the fade progress

Let `p = (dt - CORPSE_FADE_START_TICK) / fadeSpan`, the linear fade
progress in `[0, 1]`. Replace the linear `alpha = 1 - p` with:

```ts
const eased = p * p;                  // easeInQuad on the FADE side
const alpha = Math.max(0, 1 - eased);
```

`easeInQuad` on fade progress = the alpha curve accelerates downward as
it approaches 0 — the body hangs at near-full opacity through the first
half of the fade window, then sinks the rest of the way fast enough
that the cull's final disposal hides under the curve's own steepness.
The eye reads a dissolve, not a snap.

### Why not easeInCubic / easeInQuart

`p*p*p` would over-bias the hang: at the visual midpoint (`p=0.5`) the
corpse would still be at `alpha=0.875`, which reads as "the body just
froze and then vanished" — same snap, just delayed. `p*p` lands the
visual midpoint at `alpha=0.75` — still hangs longer than linear (`0.5`
at midpoint), but the back half has room to ease rather than cliff.

Tested against the easing vocabulary table:
- Linear at `p=0.5` → `alpha=0.5` (current — snap-tail)
- p² at `p=0.5` → `alpha=0.75` (proposed — hangs, then dissolves)
- p³ at `p=0.5` → `alpha=0.875` (too much hang — reads as a stutter)

### Alternative considered + rejected

A `cubic-bezier(.55,.06,.68,.19)` (CSS `easeInQuad` equivalent) is
identical in shape at this duration; the polynomial `p*p` is one
multiply versus the bezier's lerped table and reads identically at 60Hz
over 12 ticks. **Polynomial wins on simplicity** — same curve, no table.

## Affected files

- `doom/src/game/engine.ts` — one math change in the `render()` corpse-
  fade block (currently `1 - (dt - CORPSE_FADE_START_TICK) / fadeSpan`,
  becomes `1 - p*p` with `p` extracted as a local).
- `doom/src/game/types.ts` — no new constants; the curve is inlined.
  Could promote to `CORPSE_FADE_CURVE_EXPONENT = 2` if a future taste
  pass wants to dial it, but defer until shipped + felt.
- `doom/e2e/feel/` — extend (or add) a corpse-fade spec: at
  `dt = CORPSE_FADE_START_TICK + fadeSpan/2`, the published material
  opacity (read off `__doomScene` or a new test-only handle) is
  `> 0.7` (would be `0.5` under linear). At `dt = CORPSE_HOLD_TICKS`,
  opacity is `<= 0` (cull boundary).

## Acceptance criteria

1. `applyHitFlashEmissive` / the live render path is untouched — this
   change is **render-only**, mutates only THREE material `opacity`.
2. At `dt = CORPSE_FADE_START_TICK` (fade start), `alpha === 1`
   (unchanged from linear — both curves anchor at the same point).
3. At `dt = CORPSE_FADE_START_TICK + fadeSpan` (fade end), `alpha === 0`
   (unchanged from linear — both curves anchor at the same point).
4. At the midpoint `dt = CORPSE_FADE_START_TICK + fadeSpan/2`,
   `alpha === 0.75` (was `0.5` under linear). **This is the assertion
   that proves the curve change.**
5. Determinism: same input sequence → same opacity per tick (the
   change is a deterministic polynomial of `dt`, no Math.random).
6. No frame-budget regression: `p*p` is one multiply added per dead-
   enemy per render frame — well below the `#237` p99 ≤ 16.7ms gate.

## Scope (NOT in this change)

- Do NOT touch `CORPSE_HOLD_TICKS` (24) or `CORPSE_FADE_START_TICK` (12)
  — the timing is part of #194's settled beat; only the **curve shape
  within the existing window** changes.
- Do NOT add an opacity floor / hold-then-cut hybrid — the polynomial
  reaches 0 at `dt = CORPSE_HOLD_TICKS`, hitting the cull cleanly.
- Do NOT change spark/blood fades — they're already masked by motion
  (see Problem § comparison).
- Do NOT add an audio dissipation cue — the kill SFX already fired at
  death; layering more audio on the fade tail would muddy #194's
  thunky kill beat.

## Filed as

Issue: TBD (next file-wake). LOE: S. Priority: P2. Type: enhancement.
The spec is small enough to ship in one wake (~6 lines of code + e2e
assertion), but goes through file-then-ship rotation to keep Rule #9
honest.
