# Galaga stage-clear bonus tally count-up — implementation spec (#273)

**Status:** spec ready · **Issue:** #273 · **LoE:** S · **Priority:** P2
**Pattern source:** #183 (Pac-Man level-clear) · easing-vocab row
"Bonus tally count-up #273" (juice inbox)

This doc is the implementer's contract. The issue body is the *what*;
this doc is the *exact numeric spec* with the easing curve already
chosen and the feedback-channel fields named.

---

## 1. Feedback-channel fields (pure-data, on GameState)

Add to whatever struct holds Galaga's per-tick state (same place
where #241's `breathingTick` lives, same place #160's player-death
counters live):

```ts
// Stage-clear bonus tally — animates HUD score from
// scoreBeforeBonus → scoreBeforeBonus + stageBonusTallyTotal
// over 24 ticks linearly. Pure data; renderer reads.
stageBonusTallyTicks: number;   // counts DOWN from 24 to 0; 0 = inert
stageBonusTallyTotal: number;   // snapshot of the bonus (1000)
scoreBeforeBonus: number;       // score BEFORE bonus was committed
```

All three default to `0` on game init. When `stageBonusTallyTicks === 0`,
the tally is inert and the HUD reads `state.score` directly.

---

## 2. Arm sequence (engine, at stage-clear moment)

The moment is: last formation enemy removed AND no diving enemies
remaining AND current stage type is NOT a challenging stage (those
already have their own scoring rules; gate at the call site).

```ts
// 1. Snapshot the baseline BEFORE committing.
state.scoreBeforeBonus = state.score;

// 2. Commit the bonus to the canonical score IMMEDIATELY.
//    The display animates; the source of truth is already updated.
//    (Principle #20: commit score state immediately, animate the DISPLAY.)
const STAGE_BONUS = 1000;
state.score += STAGE_BONUS;

// 3. Arm the tally channel. CLOBBER, don't Math.max — this is a
//    single-channel cue (only one stage clears at a time).
state.stageBonusTallyTotal = STAGE_BONUS;
state.stageBonusTallyTicks = 24;

// 4. 6-frame hard hitstop (the punch before the count-up).
//    Use Galaga's existing hitstop channel (same one #160 uses for
//    player death's 8-frame freeze, same one #133 uses for kills).
state.hitstopTicks = Math.max(state.hitstopTicks ?? 0, 6);
```

Order matters: score commits BEFORE the tally arms, so if anything
crashes mid-arm the canonical score is already correct.

---

## 3. Decay (engine, per-tick)

In the `!frozen` block (i.e. AFTER hitstop has decremented, so the
tally doesn't tick during the 6-frame freeze — the freeze is the
breath BEFORE the count-up begins):

```ts
if (state.stageBonusTallyTicks > 0) {
  state.stageBonusTallyTicks -= 1;
}
```

That's it. No Math.max, no clamp — natural decrement to 0.

**Stage-spawn gate:** the next stage's enemy entrance sequence must
NOT spawn until `state.stageBonusTallyTicks === 0`. Find the
stage-advance call site and add the guard:

```ts
if (state.stageBonusTallyTicks > 0) return; // wait for tally to finish
// ...existing advance-to-next-stage logic...
```

The starfield + formation breathing keep running (it's a victory
pose, not a death). Only the formation-spawn pipeline is gated.

---

## 4. Render (HUD, score readout only)

Wherever the HUD currently does `String(state.score).padStart(...)`
or equivalent, replace with a `displayScore` helper:

```ts
export function displayScore(state: GameState): number {
  if (state.stageBonusTallyTicks <= 0) return state.score;
  const progress = 1 - state.stageBonusTallyTicks / 24;
  return state.scoreBeforeBonus
    + Math.floor(state.stageBonusTallyTotal * progress);
}
```

Curve = **linear** (matches the easing-vocab row exactly). Progress
goes 0 → 1 over 24 ticks. `Math.floor` keeps digits monotonic — no
flicker on the last frame.

Frame budget: zero new draw calls. Pure arithmetic in the existing
HUD render path. Safe.

---

## 5. Tone gating (challenging stages)

Galaga's challenging stages already have their own scoring rules
(per-hit bonuses, perfect-clear bonus). They do NOT get the tally:

```ts
// At the stage-clear detection site:
if (isChallengingStage(state.currentStage)) {
  // challenging stages: no tally, defer to existing scoring
  return advanceToNextStage(state);
}
// otherwise: arm the tally per §2 above
```

If the codebase doesn't yet have an `isChallengingStage` predicate,
the gate is `(stageIndex + 1) % 4 !== 0` (Galaga arcade canon:
every 4th stage is challenging). Verify against the actual stage
sequencer before hardcoding.

---

## 6. e2e acceptance (the merge gate)

New spec file at `galaga/e2e/stage-clear-bonus.spec.ts` (or mirror
existing Galaga e2e location):

```ts
import { test, expect } from '@playwright/test';

test('stage-clear bonus tally counts up monotonically', async ({ page }) => {
  // 1. Boot game, get a reference to the engine + advance-tick hook.
  await page.goto('/galaga/');
  await page.evaluate(() => (window as any).__galaga.startTestMode());

  // 2. Force-kill all formation enemies (test hook), record pre-clear score.
  const X = await page.evaluate(() => {
    const g = (window as any).__galaga;
    g.killAllFormation();         // test-only: zero out all formation HP
    g.advance(1);                  // one tick to register the clear
    return g.state.score;          // baseline AFTER commit (= scoreBeforeBonus + 1000)
  });

  // 3. During the 6-frame hitstop: displayScore is still scoreBeforeBonus.
  const baseline = await page.evaluate(
    () => (window as any).__galaga.state.scoreBeforeBonus
  );
  await page.evaluate(() => (window as any).__galaga.advance(5));
  const duringHitstop = await page.evaluate(
    () => (window as any).__galaga.displayScore()
  );
  expect(duringHitstop).toBe(baseline);

  // 4. Mid-tally (advance ~12 ticks past hitstop): displayScore is
  //    strictly between baseline and baseline + 1000.
  await page.evaluate(() => (window as any).__galaga.advance(12));
  const midTally = await page.evaluate(
    () => (window as any).__galaga.displayScore()
  );
  expect(midTally).toBeGreaterThan(baseline);
  expect(midTally).toBeLessThan(baseline + 1000);

  // 5. Post-tally (advance past 24 ticks total of decay):
  //    state.score is exactly baseline + 1000 AND displayScore matches.
  await page.evaluate(() => (window as any).__galaga.advance(20));
  const post = await page.evaluate(() => ({
    score: (window as any).__galaga.state.score,
    display: (window as any).__galaga.displayScore(),
    tallyTicks: (window as any).__galaga.state.stageBonusTallyTicks,
  }));
  expect(post.score).toBe(baseline + 1000);
  expect(post.display).toBe(baseline + 1000);
  expect(post.tallyTicks).toBe(0);
});
```

**Test-hook contract** (engine test mode — same shape as #183's
Pac-Man hook):
- `window.__galaga.advance(n)` — run `n` engine ticks deterministically
  (must reset accumulator on entry to avoid rAF backfill — see Diego's
  memory on Doom's `advance()` test hook).
- `window.__galaga.displayScore()` — return the value the HUD WOULD
  render this frame (extracted from the render path into a pure
  function for testability).
- `window.__galaga.killAllFormation()` — zero out all formation enemy
  HP for deterministic clear.

If those hooks don't exist yet, add them in the same PR — they're
exactly the kind of thing Soren's harness work wants anyway.

---

## 7. Out of scope (explicit boundary)

- **No banner / "STAGE CLEAR!" text overlay.** That's June Hallow's
  surface (copy). The tally is silent count-up only. File a
  follow-up issue if the moment reads bare AFTER the tally lands.
- **No HIT/MISS accuracy ratio.** That's the bigger sibling ticket
  (see `galaga/docs/gap-queue.md` #1) — separate, larger work.
- **No challenging-stage scoring change.** Gated out per §5.
- **No input skip.** 400ms is below the patience floor; let it play.
- **No new draw calls.** HUD already renders the score every frame.

---

## 8. Acceptance checklist (for the PR reviewer)

- [ ] 3 fields added to `GameState`, defaulted to 0 on init.
- [ ] Arm sequence runs at stage-clear detection site, BEFORE
      next-stage spawn.
- [ ] Score committed immediately; display animates only.
- [ ] 6-frame hitstop fires before tally counts down.
- [ ] Tally decay in `!frozen` block, after hitstop decrement.
- [ ] HUD reads `displayScore()` helper, not raw `state.score`.
- [ ] Stage-spawn gated on `stageBonusTallyTicks === 0`.
- [ ] Challenging stages skip the tally.
- [ ] e2e spec covers all five assertions in §6.
- [ ] No regression on existing Galaga e2e (formation entry, fire
      probe, breathing).
- [ ] No new draw calls; HUD render path same length.

---

## 9. Pattern provenance

This is a direct application of the **display-score animated count-up**
pattern banked from Pac-Man #183 (level-clear cinematic). Same shape:

1. Count-down counter, progress = 1 - n/N (0→1).
2. Commit canonical state immediately; animate DISPLAY only.
3. Decay runs in `!frozen` block, after hitstop decrement.
4. Pure-data feedback channel — engine writes, renderer reads.

Adapting to Galaga's house tone: shorter window (24t vs Pac-Man's
48t — Galaga is punchier), linear curve (vs Pac-Man's wall-cycle),
no banner (Galaga's scoreboard IS the celebration).

_Refs: #183 (Pac-Man level-clear — pattern this mirrors), #241
(Galaga breathing per-row phase lag — most recent Galaga juice
landing), #160 (Galaga player-death hitstop channel), #133 (Galaga
kill hitstop channel). Filed by Diego Salcedo._

Refs #273.
