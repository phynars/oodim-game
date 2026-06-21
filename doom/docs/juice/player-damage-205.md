# Doom — Player-damage feel polish (spec for #205)

Diego Salcedo · juice lane · complement to #194 (kill thunk)

This is the **player TAKING the thunk**. Today (post-#91), the damage
edge fires a flat red flash + linear camera shake — reads like a UI
notification, not a wound. Doom is HEAVY. The pulse must bite, then
linger. The spec below is the IMPLEMENTATION CONTRACT for #205.

---

## Edge

`damagePlayer(amount)` in `doom/src/game/engine.ts` (currently L1244).
Pulse fires for ALL damage paths — enemy melee, enemy projectile,
`forceDamage` test hook. The new writes go ALONGSIDE the existing
`hitFlashTicks = HIT_FLASH_TICKS` / `shakeTicks = SHAKE_TICKS` lines,
not in place of them.

## State surface additions

In `doom/src/game/types.ts`:

```ts
// DoomState — new field, alongside hitFlashTicks/shakeTicks/etc.
damageWobbleTicks: number;
```

In `initialState()`:

```ts
damageWobbleTicks: 0,
```

New constants exported from types.ts (alongside HIT_FLASH_TICKS, SHAKE_*):

```ts
/** Frames the engine freezes when the player takes damage (#205). Half
 *  the KILL_HITSTOP (6) on purpose — a kill is the player's victory
 *  thunk, a hit is the world's; the kill should be heavier. */
export const DAMAGE_HITSTOP_TICKS = 3;

/** Tick lifetime of the lingering low-frequency wobble channel that
 *  arms on damage (#205). 30 ticks ≈ 500ms at 60Hz — long enough that
 *  the daze reads, short enough it's gone before the next exchange. */
export const DAMAGE_WOBBLE_TICKS = 30;

/** Amplitude scale of the wobble relative to SHAKE_AMPLITUDE (#205).
 *  0.3 puts the wobble visibly under the hard shake — it's the slow
 *  sway you read AFTER the impact freezes settle, not during. */
export const DAMAGE_WOBBLE_AMPLITUDE_FACTOR = 0.3;

/** Phase rate (radians per tick) for the wobble (#205). Intentionally
 *  ~100× slower than the hard-shake channels (1.3–2.3 rad/tick) so the
 *  four concurrent channels (damage 1.7/2.3, connect 2.1/1.9, kill
 *  1.3/1.7, wobble 0.03) carry distinct frequencies and don't beat-
 *  cancel into stillness mid-burst. 0.0314 ≈ 2π × 0.3Hz / 60 ticks·s⁻¹
 *  → one full wobble cycle every ~3.3s, so over the 30-tick lifetime
 *  the eye reads ~half a sway (one side, then drift back). */
export const DAMAGE_WOBBLE_PHASE_RATE = 0.0314;

/** Per-tick multiplier on the player-damage red-flash alpha (#205).
 *  Replaces the linear fade with exponential decay so the bite reads
 *  sharp up front, then trails — the inverse envelope of the linear
 *  version that feels mushy in playtest. Applied in the HUD overlay
 *  read path: alpha = DAMAGE_FLASH_DECAY ** (HIT_FLASH_TICKS - hitFlashTicks). */
export const DAMAGE_FLASH_DECAY = 0.85;
```

## engine.ts — damagePlayer()

```ts
private damagePlayer(amount: number): void {
  const p = this.state.player;
  if (!p.alive) return;
  const soaked = Math.min(p.armor, Math.floor(amount / 3));
  p.armor -= soaked;
  p.health -= amount - soaked;

  // --- DAMAGE JUICE (#205) ------------------------------------------
  // Doom is HEAVY. A hit is a thunk + a linger.
  //   1. hitstop: 3-frame freeze. Math.max clamp (never `+=`) — past
  //      Galaga learning that cumulative juice freezes the sim.
  //   2. flash: arm hitFlashTicks as before; the HUD reads it through
  //      an exponential alpha curve (see HUD overlay; constant is
  //      DAMAGE_FLASH_DECAY).
  //   3. shake: arm shakeTicks as before (hard shake).
  //   4. wobble: NEW lingering low-frequency channel — 0.3× amp,
  //      0.3Hz, 30 ticks. Parallel to the hard shake; phase 0.0314
  //      rad/tick so it doesn't beat-cancel against the 1.3–2.3
  //      rad/tick channels.
  this.state.hitstopTicks = Math.max(
    this.state.hitstopTicks,
    DAMAGE_HITSTOP_TICKS,
  );
  this.state.hitFlashTicks = HIT_FLASH_TICKS;
  this.state.shakeTicks = SHAKE_TICKS;
  this.state.damageWobbleTicks = Math.max(
    this.state.damageWobbleTicks,
    DAMAGE_WOBBLE_TICKS,
  );

  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    this.state.status = "lost";
    this.lostTick = this.state.tick;
  }
}
```

## engine.ts — update() decay block

The existing `if (!frozen) { ... }` block that decays hitFlashTicks,
shakeTicks, hitShakeTicks, killShakeTicks — add wobble:

```ts
if (!frozen) {
  if (this.state.hitFlashTicks > 0) this.state.hitFlashTicks -= 1;
  if (this.state.shakeTicks > 0) this.state.shakeTicks -= 1;
  if (this.state.hitShakeTicks > 0) this.state.hitShakeTicks -= 1;
  if (this.state.killShakeTicks > 0) this.state.killShakeTicks -= 1;
  if (this.state.damageWobbleTicks > 0) this.state.damageWobbleTicks -= 1; // #205
  for (const e of this.state.enemies) {
    if (e.hitFlashTicks > 0) e.hitFlashTicks -= 1;
  }
}
```

## engine.ts — syncCamera() offset sum

After the existing damage / connect / kill shake blocks, append:

```ts
// Damage wobble (#205): lingering low-frequency horizontal sway,
// arms alongside the hard damage shake. 0.3× amplitude, 0.3Hz
// (phase 0.0314 rad/tick), linear amplitude decay over
// DAMAGE_WOBBLE_TICKS. Horizontal only — sells "stumbled sideways"
// without lifting the camera off the floor plane (which would read
// as a hop, wrong genre). Distinct phase rate from the hard-shake
// channels (1.3–2.3) so summing four channels stays incoherent and
// doesn't beat-cancel.
if (this.state.damageWobbleTicks > 0) {
  const kw = this.state.damageWobbleTicks / DAMAGE_WOBBLE_TICKS; // 1 → 0
  const phaseW = this.state.tick;
  ox +=
    Math.sin(phaseW * DAMAGE_WOBBLE_PHASE_RATE) *
    SHAKE_AMPLITUDE *
    DAMAGE_WOBBLE_AMPLITUDE_FACTOR *
    kw;
  // no oy term — wobble is sway, not bob.
}
```

## HUD overlay — exponential flash alpha

Wherever the red full-screen flash reads `hitFlashTicks` (HUD layer,
likely `apps/web` or a doom-local overlay component — implementer to
find via grep `hitFlashTicks` outside engine.ts), replace:

```ts
// Linear (current):
const alpha = state.hitFlashTicks / HIT_FLASH_TICKS;
```

with:

```ts
// Exponential (#205): sharp bite up front, trails to ~10% at end.
const elapsed = HIT_FLASH_TICKS - state.hitFlashTicks;
const alpha = state.hitFlashTicks > 0
  ? Math.pow(DAMAGE_FLASH_DECAY, elapsed)
  : 0;
```

If HIT_FLASH_TICKS = 12, the curve goes:

| elapsed | linear | exponential (×0.85) |
| ------- | ------ | ------------------- |
| 0       | 1.000  | 1.000               |
| 1       | 0.917  | 0.850               |
| 3       | 0.750  | 0.614               |
| 6       | 0.500  | 0.377               |
| 9       | 0.250  | 0.232               |
| 12      | 0.000  | 0.142 → clipped to 0 by ticks-elapsed gate |

The bite at tick 1 is 0.85 vs 0.92 (sharper drop), and the tail at
tick 9 (~150ms) is 0.23 vs 0.25 (about the same) — the felt
difference is the SHAPE: linear is a ramp, exponential is a slam +
trail.

## e2e (`doom/e2e/`)

New spec, mirroring the shape of #194's death spec:

```ts
test("player damage arms hitstop + wobble + does not freeze sim", async ({ page }) => {
  await page.goto("/doom/");
  await page.evaluate(() => window.__doomInternals.advance({ steps: 1, forward: true }));
  // Pre: counters all zero
  const before = await page.evaluate(() => ({
    hitstop: window.__doom.hitstopTicks,
    wobble: window.__doom.damageWobbleTicks,
    flash: window.__doom.hitFlashTicks,
  }));
  expect(before.hitstop).toBe(0);
  expect(before.wobble).toBe(0);

  // Take a hit.
  await page.evaluate(() => window.__doomInternals.forceDamage({ amount: 10 }));

  // Same-publish assertions: all three channels armed.
  const after = await page.evaluate(() => ({
    hitstop: window.__doom.hitstopTicks,
    wobble: window.__doom.damageWobbleTicks,
    flash: window.__doom.hitFlashTicks,
    tick: window.__doom.tick,
  }));
  expect(after.hitstop).toBeGreaterThanOrEqual(3);
  expect(after.wobble).toBe(30);
  expect(after.flash).toBeGreaterThan(0);

  // Wait out the wobble (30 sim ticks + a buffer for the hitstop hang).
  await page.evaluate(() => window.__doomInternals.advance({ steps: 40 }));
  const final = await page.evaluate(() => ({
    wobble: window.__doom.damageWobbleTicks,
    hitstop: window.__doom.hitstopTicks,
    alive: window.__doom.player.alive,
  }));
  expect(final.wobble).toBe(0);
  expect(final.hitstop).toBe(0);
  expect(final.alive).toBe(true);
});

test("concurrent damage + kill shake do not freeze the sim", async ({ page }) => {
  await page.goto("/doom/");
  await page.evaluate(() => window.__doomInternals.advance({ steps: 1, forward: true }));
  // Trigger BOTH a kill (kill-shake + kill-hitstop) AND damage
  // (damage-shake + wobble + damage-hitstop) on the same tick.
  await page.evaluate(() => {
    window.__doomInternals.forceHit();
    window.__doomInternals.forceDamage({ amount: 10 });
  });
  // The MAX-clamped hitstop floor is KILL_HITSTOP(6), not the sum.
  const after = await page.evaluate(() => window.__doom.hitstopTicks);
  expect(after).toBeLessThanOrEqual(6);
  expect(after).toBeGreaterThanOrEqual(3);

  // Sim must thaw on schedule — drive 100 ticks, sim must have progressed
  // (tick counter advanced past the hitstop hang).
  const tickBefore = await page.evaluate(() => window.__doom.tick);
  await page.evaluate(() => window.__doomInternals.advance({ steps: 100 }));
  const tickAfter = await page.evaluate(() => window.__doom.tick);
  expect(tickAfter - tickBefore).toBeGreaterThan(90); // not 100 (hitstop ate a few)
});
```

## Acceptance checklist (from #205)

- [ ] `damageWobbleTicks` added to DoomState + initialState
- [ ] DAMAGE_HITSTOP_TICKS=3, DAMAGE_WOBBLE_TICKS=30,
      DAMAGE_WOBBLE_AMPLITUDE_FACTOR=0.3,
      DAMAGE_WOBBLE_PHASE_RATE=0.0314,
      DAMAGE_FLASH_DECAY=0.85 exported from types.ts
- [ ] damagePlayer() max-clamps hitstopTicks to ≥3 (never `+=`)
- [ ] damagePlayer() max-clamps damageWobbleTicks to ≥30
- [ ] Decay block in update() decrements damageWobbleTicks under `!frozen`
- [ ] syncCamera() sums wobble into `ox` (horizontal only)
- [ ] HUD overlay uses Math.pow(0.85, elapsed) for flash alpha
- [ ] e2e: damage edge arms hitstop≥3 + wobble=30 + flash>0 same publish
- [ ] e2e: 40 ticks post-damage → all three back to 0, player alive
- [ ] e2e: concurrent kill+damage stays max-clamped, sim thaws
- [ ] #194 kill juice still passes its existing e2e (no regression)

## Refs

- #205 (this spec's issue)
- #91 (original linear flash + shake — being replaced)
- #166 (connect-shake pattern — channel discipline reference)
- #194 (kill-shake k² envelope — the thunk this is the inverse of)
- juice/inbox.md (working principle 13: distinct phase rates per channel)
