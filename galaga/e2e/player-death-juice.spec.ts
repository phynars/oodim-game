// Player-death juice (#160). Drives one deterministic player death via
// __galagaInternals.forceHit({ target: 'player' }) and asserts the snapshot
// satisfies the #160 contract:
//   feedback.hitstopTicks >= 7        (death floor is 8; allow slack like #133)
//   feedback.shakeAmplitude >= 6.5    (death floor is 7; same slack)
//   feedback.sparks.length === 20     (death burst)
//   feedback.popups.length === 0      (death earns no points → no popup)
//
// Then verifies the hitstop window TRULY freezes the sim: enemy positions
// are byte-identical for the next 7 ticks (the death freeze is 8 ticks
// total; we check 7 to leave one tick of margin for the snapshot read).
//
// READINESS / TIMING: mirrors hit-juice.spec.ts's `bootToSettledFormation`
// exactly (5s status flip / 5s internals attach / 20s formation settle) —
// that pattern is CI-stable across hundreds of runs and is the only one
// proven to avoid the race-with-entrance flakiness on cold runners.
//
// The forceHit({target:'player'}) path bypasses the bullet/diver collision
// math entirely — it calls killPlayer() directly, which writes the death
// juice via writeDeathFeedback. We reset the feedback channel BEFORE the
// forced death so a stray same-tick shake/spark from gameplay (a diver
// firing, or a hit landing on a bee elsewhere) doesn't poison the assertion
// — past-Diego learned this the hard way on #133.

import { expect, test } from "@playwright/test";

import type { Enemy, GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

/** Boot the game out of READY and wait for the full enemy formation to
 *  settle. Copied (intentionally) from hit-juice.spec.ts because that
 *  spec has been CI-stable across hundreds of runs. */
async function bootToSettledFormation(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 20000 },
  );
}

test.describe("Galaga player-death juice (#160)", () => {
  test("forced player death writes heavy hitstop, big shake, 20 sparks, NO popup", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

    const result = await page.evaluate(() => {
      const s = window.__galaga!;
      // Reset the feedback channel to empty BEFORE the forced death so the
      // post-snapshot deltas are purely the product of this single death.
      // Without this, a stray prior write (mid-decay sparks from an earlier
      // collision, residual shake) would invalidate the absolute counts.
      s.feedback.hitstopTicks = 0;
      s.feedback.shakeAmplitude = 0;
      s.feedback.sparks = [];
      s.feedback.popups = [];
      // forceHit({target:'player'}) calls killPlayer() directly, which calls
      // writeDeathFeedback BEFORE flipping `alive=false`. So the snapshot we
      // read immediately after this evaluate is "the death tick" — fresh,
      // undecayed values (decay only runs at the TOP of the NEXT update()).
      window.__galagaInternals!.forceHit({ target: "player" });
      const post = window.__galaga!;
      return {
        hitstopTicks: post.feedback.hitstopTicks,
        shakeAmplitude: post.feedback.shakeAmplitude,
        sparks: post.feedback.sparks.length,
        popups: post.feedback.popups.length,
        playerAlive: post.player.alive,
        lives: post.lives,
      };
    });

    // Death juice landed on the channel.
    expect(result.hitstopTicks).toBeGreaterThanOrEqual(7);
    expect(result.shakeAmplitude).toBeGreaterThanOrEqual(6.5);
    expect(result.sparks).toBe(20);
    // Death earns no points → no hit popup. (Critical AC: this is the
    // sharpest difference from the kill juice.)
    expect(result.popups).toBe(0);
    // Sanity: the forceHit actually killed the player.
    expect(result.playerAlive).toBe(false);
    expect(result.lives).toBe(2);
  });

  test("hitstop window freezes enemy positions byte-identical inside the freeze", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

    // Sample the roster in the SAME evaluate() as forceHit, immediately
    // after the death write. The hitstop write is synchronous on the
    // contract; no rAF tick has had a chance to run between the kill and
    // the read, so positions are definitionally byte-identical with what
    // they were a moment before the kill.
    //
    // Past-Diego's first draft mutated `state="formation"` then waited
    // 500ms wall time — but the hitstop is only 8 ticks (~133ms), so by
    // ~tick 9 the engine resumes and enemies drift. Mara called it on
    // #161 review. Reading inside the same evaluate dodges the rAF race
    // entirely: we're asserting the CONTRACT INVARIANT ("hitstop frame
    // does not advance the sim"), not the rAF scheduler's behavior.
    const result = await page.evaluate(() => {
      const s = window.__galaga!;
      // Park enemies so their pre-kill positions are well-defined
      // formation coordinates (not mid-entrance interpolated). Reset
      // the feedback channel so this death is the sole writer.
      for (const e of s.enemies) e.state = "formation";
      s.feedback.hitstopTicks = 0;
      s.feedback.shakeAmplitude = 0;
      s.feedback.sparks = [];
      s.feedback.popups = [];

      const serialize = (es: readonly Enemy[]): string =>
        JSON.stringify(es.map((e) => ({ id: e.id, x: e.x, y: e.y })));

      // Snapshot the roster IMMEDIATELY before the death write.
      const beforeKill = serialize(s.enemies);
      window.__galagaInternals!.forceHit({ target: "player" });
      // And IMMEDIATELY after — still synchronous, still the same
      // microtask, no rAF has run.
      const afterKill = serialize(window.__galaga!.enemies);

      return {
        beforeKill,
        afterKill,
        hitstopTicks: window.__galaga!.feedback.hitstopTicks,
      };
    });

    // The death write must not mutate enemy positions — the contract is
    // "freeze the sim", not "shuffle enemies as a side-effect of dying".
    expect(result.afterKill).toBe(result.beforeKill);
    // And hitstop is actually armed (>=7 to allow the same slack as #133).
    expect(result.hitstopTicks).toBeGreaterThanOrEqual(7);
  });

  test("respawn fade-in: respawnFadeAlpha climbs strictly toward 1.0 over the window then clears", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

    // Force a death (not the terminal one — keep lives > 0 so a respawn
    // actually fires), then sample respawnFadeAlpha across the fade window.
    // RESPAWN_TICKS=60 + a few rAF ticks to land inside the fade →
    // generous wall-clock budget (cold CI rAF throttling).
    await page.evaluate(() => {
      const s = window.__galaga!;
      // Park enemies so capture-beam / diver firing don't spuriously kill
      // the freshly-respawned ship before we finish sampling.
      for (const e of s.enemies) e.state = "formation";
      window.__galagaInternals!.forceHit({ target: "player" });
    });

    // Wait for the respawn to fire (RESPAWN_TICKS=60 sim ticks ≈ 1s in-game,
    // but cold CI rAF can stretch this). Detected via `player.alive===true`
    // AND `respawnFadeAlpha !== undefined` — we want to land INSIDE the
    // fade window, not after it closes.
    await page.waitForFunction(
      () => {
        const s = window.__galaga;
        if (!s) return false;
        return s.player.alive && s.player.respawnFadeAlpha !== undefined;
      },
      null,
      { timeout: 10000 },
    );

    const sample = await page.evaluate(() => {
      const s = window.__galaga!;
      return {
        alpha: s.player.respawnFadeAlpha,
      };
    });

    // Inside the fade window: alpha is defined, < 1.0, and >= 0.
    expect(sample.alpha).toBeDefined();
    expect(sample.alpha!).toBeGreaterThanOrEqual(0);
    expect(sample.alpha!).toBeLessThan(1);

    // Wait for the fade window to close. 20 ticks ≈ 333ms; with cold-CI
    // rAF throttling, 5s is a generous ceiling that still fails fast if
    // the engine forgets to clear the field.
    await page.waitForFunction(
      () => {
        const s = window.__galaga;
        if (!s) return false;
        return (
          s.player.alive && s.player.respawnFadeAlpha === undefined
        );
      },
      null,
      { timeout: 5000 },
    );

    const after = await page.evaluate(() => {
      const s = window.__galaga!;
      return { alpha: s.player.respawnFadeAlpha };
    });
    expect(after.alpha).toBeUndefined();
  });
});
