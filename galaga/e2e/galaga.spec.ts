// Gameplay harness for Galaga — the scaffold floor. These two tests assert
// the load-bearing `window.__galaga` contract boots and the fixed-step loop
// actually ticks once started. Backlog slices ADD tests here (ship movement,
// firing, the enemy formation, diving, collision/lives, scoring/stages, the
// boss capture beam + dual-fighter rescue, the challenging stage) — each new
// mechanic must ship with a failing-first assertion against `window.__galaga`,
// the same "CI for gameplay" discipline Pac-Man's e2e/pacman.spec.ts uses.

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

test("boots the state contract: ready, 3 lives, stage 1, player + field present", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  const s = await page.evaluate(() => window.__galaga!);
  expect(s.status).toBe("ready");
  expect(s.lives).toBe(3);
  expect(s.stage).toBe(1);
  expect(s.score).toBe(0);
  expect(s.player.alive).toBe(true);
  expect(s.player.captured).toBe(false);
  expect(s.player.dual).toBe(false);
  expect(s.field.width).toBeGreaterThan(0);
  expect(s.field.height).toBeGreaterThan(0);
  // Rosters exist (empty in the scaffold) so consumers can read them safely.
  expect(Array.isArray(s.enemies)).toBe(true);
  expect(Array.isArray(s.bullets)).toBe(true);
});

test("first input flips ready→playing and the fixed-step loop advances tick", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  expect(await page.evaluate(() => window.__galaga!.status)).toBe("ready");

  // Focus the canvas + send an input; the engine leaves READY on first input.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");

  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // The tick counter only advances while playing — prove the loop runs.
  const t1 = await page.evaluate(() => window.__galaga!.tick);
  await page.waitForFunction((t) => (window.__galaga?.tick ?? 0) > t, t1, {
    timeout: 5000,
  });
  const t2 = await page.evaluate(() => window.__galaga!.tick);
  expect(t2).toBeGreaterThan(t1);
});

test("player ship moves left then right under keyboard input, clamped to the field", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  // Capture the spawn x and field width up front; the contract guarantees
  // y is constant so we sample it too and assert it never changes.
  const start = await page.evaluate(() => ({
    x: window.__galaga!.player.x,
    y: window.__galaga!.player.y,
    width: window.__galaga!.field.width,
  }));

  await page.locator("canvas").click();

  // Hold ArrowLeft long enough to traverse well past the left edge — the
  // clamp must keep x >= 0 (the assertion below also checks the visible
  // sprite stays inside the playfield).
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(
    (sx) => (window.__galaga?.player.x ?? sx) < sx - 5,
    start.x,
    { timeout: 5000 },
  );
  // Keep pressing past the wall so the clamp is exercised.
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowLeft");

  const afterLeft = await page.evaluate(() => window.__galaga!.player);
  expect(afterLeft.x).toBeLessThan(start.x);
  expect(afterLeft.x).toBeGreaterThanOrEqual(0);
  expect(afterLeft.x).toBeLessThanOrEqual(start.width);
  expect(afterLeft.y).toBe(start.y);

  // Now drive right past the opposite wall.
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (lx) => (window.__galaga?.player.x ?? lx) > lx + 5,
    afterLeft.x,
    { timeout: 5000 },
  );
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowRight");

  const afterRight = await page.evaluate(() => window.__galaga!.player);
  expect(afterRight.x).toBeGreaterThan(afterLeft.x);
  expect(afterRight.x).toBeGreaterThanOrEqual(0);
  expect(afterRight.x).toBeLessThanOrEqual(start.width);
  expect(afterRight.y).toBe(start.y);
});

test("Space fires a player bullet that travels upward; cap is 2 concurrent", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  // Leave READY and start the loop.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // Fire one shot. The bullet should appear in `bullets` with from:'player'
  // and a `y` value (record it so we can prove it decreases next).
  await page.keyboard.press(" ");
  await page.waitForFunction(
    () => (window.__galaga?.bullets ?? []).some((b) => b.from === "player"),
    null,
    { timeout: 2000 },
  );
  const firstBullet = await page.evaluate(() => {
    const b = window.__galaga!.bullets.find((x) => x.from === "player");
    return b ? { x: b.x, y: b.y } : null;
  });
  expect(firstBullet).not.toBeNull();

  // After a few ticks, SOME player bullet's `y` must be strictly less than
  // the spawn `y` we observed — i.e. the shot is moving up. We don't track
  // identity (no id on bullets per the contract), so we check the minimum
  // player-bullet y has dropped below the spawn y.
  await page.waitForFunction(
    (spawnY) => {
      const ys = (window.__galaga?.bullets ?? [])
        .filter((b) => b.from === "player")
        .map((b) => b.y);
      if (ys.length === 0) return false;
      return Math.min(...ys) < spawnY - 5;
    },
    firstBullet!.y,
    { timeout: 3000 },
  );

  // Fire FIVE more presses in quick succession. The cap is 2 concurrent
  // player bullets — at no observation point should the live count exceed 2.
  // We sample the count between presses to catch a buggy implementation that
  // briefly spawns a 3rd before pruning.
  const maxObserved = await page.evaluate(async () => {
    let max = (window.__galaga?.bullets ?? []).filter(
      (b) => b.from === "player",
    ).length;
    // The Playwright keyboard helper isn't available inside evaluate, so we
    // dispatch raw KeyboardEvents — same code path the input source uses.
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: " ", bubbles: true }),
      );
      // Yield a frame so the engine ticks and we sample fresh state.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const live = (window.__galaga?.bullets ?? []).filter(
        (b) => b.from === "player",
      ).length;
      if (live > max) max = live;
    }
    return max;
  });
  expect(maxObserved).toBeLessThanOrEqual(2);
});

test("enemy roster flies in and settles into a formation of bees, butterflies, and bosses", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  // Leave READY so the formation choreography starts ticking.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // Once any enemies are present, the contract demands non-empty + all three
  // archetypes once the entrance choreography has played out. Give it enough
  // wall time for the full staggered entrance: ~8 columns × 5 rows ×
  // SPAWN_INTERVAL plus the ENTRANCE_TICKS arc, well under 10s at 60Hz.
  await page.waitForFunction(
    () => (window.__galaga?.enemies?.length ?? 0) > 0,
    null,
    { timeout: 5000 },
  );

  // Wait until EVERY enemy has reached 'formation'. This is the load-bearing
  // assertion: the entrance arcs must terminate, not loop or stall.
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 10000 },
  );

  const enemies = await page.evaluate(() => window.__galaga!.enemies);
  expect(enemies.length).toBeGreaterThan(0);
  expect(enemies.every((e) => e.state === "formation")).toBe(true);

  const kinds = new Set(enemies.map((e) => e.kind));
  expect(kinds.has("bee")).toBe(true);
  expect(kinds.has("butterfly")).toBe(true);
  expect(kinds.has("boss")).toBe(true);

  // Each enemy publishes the minimal shape consumers depend on.
  for (const e of enemies) {
    expect(typeof e.id).toBe("number");
    expect(["bee", "butterfly", "boss"]).toContain(e.kind);
    expect(typeof e.x).toBe("number");
    expect(typeof e.y).toBe("number");
  }
});

test("after the formation settles, an enemy peels off into 'diving' and its y increases during the dive", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  // Leave READY so the formation choreography starts.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // Wait until at least one enemy is in the 'diving' state. The first dive
  // launches after the full formation has settled + DIVE_START_DELAY ticks,
  // so allow generous wall time at 60Hz.
  await page.waitForFunction(
    () => (window.__galaga?.enemies ?? []).some((e) => e.state === "diving"),
    null,
    { timeout: 20000 },
  );

  // Snapshot the diver's id and starting y. We track by id so the same
  // enemy is followed across ticks (other enemies are still breathing in
  // the formation; we only care about this one's descent).
  const start = await page.evaluate(() => {
    const diver = (window.__galaga?.enemies ?? []).find(
      (e) => e.state === "diving",
    );
    return diver ? { id: diver.id, y: diver.y } : null;
  });
  expect(start).not.toBeNull();

  // The contract: during the dive, `y` increases (the diver descends toward
  // the player at the bottom of the field). Wait for a strictly larger y
  // value on the SAME enemy id.
  await page.waitForFunction(
    (s) => {
      const same = (window.__galaga?.enemies ?? []).find((e) => e.id === s.id);
      return Boolean(same && same.y > s.y + 1);
    },
    start!,
    { timeout: 5000 },
  );

  const mid = await page.evaluate(
    (id) => (window.__galaga?.enemies ?? []).find((e) => e.id === id) ?? null,
    start!.id,
  );
  expect(mid).not.toBeNull();
  expect(mid!.y).toBeGreaterThan(start!.y);

  // And the dive must terminate — the same enemy returns to 'formation'.
  // (Generous timeout: DIVE_TICKS at 60Hz ≈ 2s, plus easing slack.)
  await page.waitForFunction(
    (id) => {
      const same = (window.__galaga?.enemies ?? []).find((e) => e.id === id);
      return Boolean(same && same.state === "formation");
    },
    start!.id,
    { timeout: 10000 },
  );
});

test("forceHit({target:'enemy'}) removes the enemy + scores; forceHit({target:'player'}) decrements lives", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  // Leave READY + wait for the formation to populate so we have an enemy
  // to hit. The forceHit hook doesn't require a settled enemy, just a live
  // one in the roster, so we wait for length>0.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(
    () => (window.__galaga?.enemies?.length ?? 0) > 0,
    null,
    { timeout: 10000 },
  );
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });

  // --- Player bullet hits an enemy: roster count drops, score goes up. ---
  const before = await page.evaluate(() => ({
    count: window.__galaga!.enemies.length,
    score: window.__galaga!.score,
  }));
  await page.evaluate(() =>
    window.__galagaInternals!.forceHit({ target: "enemy" }),
  );
  const afterEnemyHit = await page.evaluate(() => ({
    count: window.__galaga!.enemies.length,
    score: window.__galaga!.score,
  }));
  expect(afterEnemyHit.count).toBe(before.count - 1);
  expect(afterEnemyHit.score).toBeGreaterThan(before.score);

  // --- Enemy hit kills the player: alive=false, lives decrements. ---
  const livesBefore = await page.evaluate(() => window.__galaga!.lives);
  expect(livesBefore).toBeGreaterThan(0);

  await page.evaluate(() =>
    window.__galagaInternals!.forceHit({ target: "player" }),
  );
  const afterPlayerHit = await page.evaluate(() => ({
    alive: window.__galaga!.player.alive,
    lives: window.__galaga!.lives,
    status: window.__galaga!.status,
  }));
  expect(afterPlayerHit.alive).toBe(false);
  expect(afterPlayerHit.lives).toBe(livesBefore - 1);
  // Still mid-game — we had >0 lives left after this single hit.
  expect(afterPlayerHit.status).toBe("playing");

  // The respawn timer should bring the fighter back alive within a few
  // ticks (RESPAWN_TICKS=60 ≈ 1s); proves the death pause terminates.
  await page.waitForFunction(() => window.__galaga?.player.alive === true, null, {
    timeout: 5000,
  });
});

test("clearing the formation advances the stage, respawns a fresh non-empty formation, and score accumulates across stages", async ({
  page,
}) => {
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

  // Wait for the entire formation to spawn + settle so `isEmpty()` will
  // legitimately be true once we kill them all (stage-clear is gated on
  // "everPopulated && no pending spawns"). Mirrors the formation test.
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 15000 },
  );

  // Baseline before the clear.
  const before = await page.evaluate(() => ({
    stage: window.__galaga!.stage,
    score: window.__galaga!.score,
    initialCount: window.__galaga!.enemies.length,
  }));
  expect(before.stage).toBe(1);
  expect(before.initialCount).toBeGreaterThan(0);

  // Per-kind scoring: kill exactly one of each archetype FIRST and capture
  // the score delta. Each delta must be > 0 — proves SCORE_BY_KIND fires
  // per kill, not just at stage-clear.
  const perKindDeltas = await page.evaluate(() => {
    const kinds: Array<"bee" | "butterfly" | "boss"> = [
      "bee",
      "butterfly",
      "boss",
    ];
    const deltas: Record<string, number> = {};
    for (const k of kinds) {
      const target = (window.__galaga?.enemies ?? []).find((e) => e.kind === k);
      if (!target) continue;
      const s0 = window.__galaga!.score;
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
      });
      deltas[k] = window.__galaga!.score - s0;
    }
    return deltas;
  });
  expect(perKindDeltas.bee ?? 0).toBeGreaterThan(0);
  expect(perKindDeltas.butterfly ?? 0).toBeGreaterThan(0);
  expect(perKindDeltas.boss ?? 0).toBeGreaterThan(0);

  // Now mop up the rest of the formation by id. Loop until enemies is
  // empty AND stage has incremented (the engine bumps stage on the tick
  // it observes a cleared roster). We re-read ids each pass because the
  // controller's tick() re-emits surviving roster members.
  await page.evaluate(async () => {
    // Safety bound — formation is at most a few dozen enemies; 200 hits
    // is comfortable headroom in case a tick rebuilds the snapshot.
    for (let i = 0; i < 200; i++) {
      const enemies = window.__galaga?.enemies ?? [];
      if (enemies.length === 0) break;
      const target = enemies[0];
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  });

  // Stage must advance. We allow generous wall time because the engine
  // checks `maybeAdvanceStage` per tick after collisions resolve.
  await page.waitForFunction(
    (priorStage) => (window.__galaga?.stage ?? priorStage) > priorStage,
    before.stage,
    { timeout: 5000 },
  );

  const afterClear = await page.evaluate(() => ({
    stage: window.__galaga!.stage,
    score: window.__galaga!.score,
  }));
  expect(afterClear.stage).toBe(before.stage + 1);
  // Score must have accumulated across kills — never reset on stage flip.
  expect(afterClear.score).toBeGreaterThan(before.score);

  // The next stage's formation respawns. Wait for a fresh non-empty roster
  // — the contract is "stage++ → new enemies appear", not "stage++ then
  // empty forever".
  await page.waitForFunction(
    () => (window.__galaga?.enemies?.length ?? 0) > 0,
    null,
    { timeout: 15000 },
  );

  const stage2 = await page.evaluate(() => window.__galaga!.enemies);
  expect(stage2.length).toBeGreaterThan(0);

  // And score keeps growing into stage 2 — kill one and confirm.
  const scoreBeforeStage2Kill = afterClear.score;
  await page.evaluate(() => {
    const target = (window.__galaga?.enemies ?? [])[0];
    if (target) {
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
      });
    }
  });
  const scoreAfterStage2Kill = await page.evaluate(
    () => window.__galaga!.score,
  );
  expect(scoreAfterStage2Kill).toBeGreaterThan(scoreBeforeStage2Kill);
});

test("running out of lives flips status to 'lost'", async ({ page }) => {
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

  // Hit the player once, wait for respawn, repeat — until lives hit 0 and
  // status flips to 'lost'. We bound the loop generously; the contract
  // starts at lives=3 so at most 3 fatal hits.
  for (let i = 0; i < 6; i++) {
    const lives = await page.evaluate(() => window.__galaga!.lives);
    if (lives <= 0) break;
    await page.waitForFunction(() => window.__galaga?.player.alive === true, null, {
      timeout: 5000,
    });
    await page.evaluate(() =>
      window.__galagaInternals!.forceHit({ target: "player" }),
    );
  }

  const final = await page.evaluate(() => ({
    lives: window.__galaga!.lives,
    status: window.__galaga!.status,
  }));
  expect(final.lives).toBe(0);
  expect(final.status).toBe("lost");
});
