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

test("boss tractor beam captures the player: captureBeamActive→true, player.captured→true, an 'escort' enemy appears", async ({
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

  // Wait for the formation to populate enough that at least one boss is on
  // stage — the trigger hook needs an existing boss to capture with.
  await page.waitForFunction(
    () =>
      (window.__galaga?.enemies ?? []).some((e) => e.kind === "boss"),
    null,
    { timeout: 15000 },
  );

  // Baseline: no beam, not captured, no escort.
  const before = await page.evaluate(() => ({
    beam: window.__galaga!.captureBeamActive,
    captured: window.__galaga!.player.captured,
    lives: window.__galaga!.lives,
    hasEscort: window.__galaga!.enemies.some((e) => e.state === "escort"),
  }));
  expect(before.beam).toBe(false);
  expect(before.captured).toBe(false);
  expect(before.hasEscort).toBe(false);

  // Trigger the capture — the hook parks a boss above the player + arms
  // the beam. The engine then closes the loop on the next tick.
  await page.evaluate(() =>
    window.__galagaInternals!.triggerBossCapture(),
  );

  // captureBeamActive must go true (contract assertion #1).
  await page.waitForFunction(
    () => window.__galaga?.captureBeamActive === true,
    null,
    { timeout: 3000 },
  );

  // Then the capture must complete: player.captured=true (contract #2)
  // AND some enemy is in state:'escort' (contract #3).
  await page.waitForFunction(
    () =>
      window.__galaga?.player.captured === true &&
      (window.__galaga?.enemies ?? []).some((e) => e.state === "escort"),
    null,
    { timeout: 5000 },
  );

  const after = await page.evaluate(() => ({
    beam: window.__galaga!.captureBeamActive,
    captured: window.__galaga!.player.captured,
    lives: window.__galaga!.lives,
    escortCount: window.__galaga!.enemies.filter((e) => e.state === "escort")
      .length,
  }));
  expect(after.beam).toBe(true);
  expect(after.captured).toBe(true);
  expect(after.escortCount).toBeGreaterThan(0);
  // Lives must have decremented — capture costs one fighter.
  expect(after.lives).toBe(before.lives - 1);
});

test("destroying the captor frees the escort and arms the dual fighter", async ({
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

  // Wait for at least one boss to be on stage so the capture hook has a
  // captor to arm.
  await page.waitForFunction(
    () => (window.__galaga?.enemies ?? []).some((e) => e.kind === "boss"),
    null,
    { timeout: 15000 },
  );

  // Baseline: not dual, not captured, no escort.
  const before = await page.evaluate(() => ({
    dual: window.__galaga!.player.dual,
    captured: window.__galaga!.player.captured,
    hasEscort: window.__galaga!.enemies.some((e) => e.state === "escort"),
  }));
  expect(before.dual).toBe(false);
  expect(before.captured).toBe(false);
  expect(before.hasEscort).toBe(false);

  // Stage the capture: arm the beam, wait for the engine to complete the
  // capture (player.captured=true AND an 'escort' enemy appears).
  await page.evaluate(() => window.__galagaInternals!.triggerBossCapture());
  await page.waitForFunction(
    () =>
      window.__galaga?.player.captured === true &&
      (window.__galaga?.enemies ?? []).some((e) => e.state === "escort"),
    null,
    { timeout: 5000 },
  );

  // Identify the captor — the boss currently in 'capturing' state — and
  // kill it via the test hook. This is the load-bearing assertion for #38.
  const captorId = await page.evaluate(() => {
    const captor = (window.__galaga?.enemies ?? []).find(
      (e) => e.state === "capturing",
    );
    return captor?.id ?? null;
  });
  expect(captorId).not.toBeNull();

  await page.evaluate(
    (id) =>
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: id ?? undefined,
      }),
    captorId,
  );

  // After the captor dies: player.dual must be true AND no enemy is in
  // 'escort' state anymore (the escort docked beside the player).
  await page.waitForFunction(
    () =>
      window.__galaga?.player.dual === true &&
      !(window.__galaga?.enemies ?? []).some((e) => e.state === "escort"),
    null,
    { timeout: 3000 },
  );

  const after = await page.evaluate(() => ({
    dual: window.__galaga!.player.dual,
    captured: window.__galaga!.player.captured,
    escortCount: window.__galaga!.enemies.filter((e) => e.state === "escort")
      .length,
  }));
  expect(after.dual).toBe(true);
  expect(after.escortCount).toBe(0);
  // Rescue clears the captured flag too — the fighter is back under
  // player control.
  expect(after.captured).toBe(false);
});

test("draining lives surfaces GAME OVER: status reaches 'gameover', HUD lives reads 0, overlay visible", async ({
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

  // Baseline: overlay hidden before any deaths.
  const overlay = page.locator('[data-overlay="gameover"]');
  await expect(overlay).toBeHidden();

  // Drain every life through the harness hook. We wait for alive=true
  // between hits so each forceHit lands on a live fighter (not during the
  // respawn pause). At lives=0 the engine flips status to 'lost' without
  // re-arming the respawn timer, so the loop exits on the post-hit lives
  // check rather than waiting for an alive flip that will never come.
  for (let i = 0; i < 8; i++) {
    const lives = await page.evaluate(() => window.__galaga!.lives);
    if (lives <= 0) break;
    await page.waitForFunction(
      () => window.__galaga?.player.alive === true,
      null,
      { timeout: 5000 },
    );
    await page.evaluate(() =>
      window.__galagaInternals!.forceHit({ target: "player" }),
    );
  }

  // Contract: HUD reads 0 lives (data-hud="lives" mirrors window.__galaga.lives).
  await expect(page.locator('[data-hud="lives"]')).toHaveText("0", {
    timeout: 3000,
  });

  // Contract: status transitions through 'lost' to the terminal 'gameover'.
  // The engine holds briefly in 'lost' so the death frame reads before the
  // overlay paints; we wait for the final 'gameover' state.
  await page.waitForFunction(
    () => window.__galaga?.status === "gameover",
    null,
    { timeout: 5000 },
  );

  // Contract: the GAME OVER overlay is visible once we're in a terminal
  // state. The element lives in index.html (data-overlay="gameover") and is
  // toggled by main.ts from the window.__galaga.status contract.
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText(/GAME OVER/i);

  const final = await page.evaluate(() => ({
    lives: window.__galaga!.lives,
    status: window.__galaga!.status,
  }));
  expect(final.lives).toBe(0);
  expect(final.status).toBe("gameover");
});

test("mobile viewport: tapping FIRE spawns a player bullet and tapping LEFT moves the ship", async ({
  browser,
}) => {
  // Emulate a typical phone — portrait, touch primary, viewport ≈ iPhone 12.
  // hasTouch=true makes Playwright dispatch real pointer/touch events on
  // `tap()` so the touch InputSource's pointerdown listeners fire (a regular
  // click would only land mouse events). A pre-change run lacks the three
  // [data-touch] buttons entirely, so taps land on empty layout and no
  // bullet ever spawns — i.e. this test fails on the prior code and passes
  // after the touch pad + createTouchInput wiring lands.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__galaga));

    // The touch pad must be present + visible on a touch viewport.
    const fire = page.locator('[data-touch="fire"]');
    const left = page.locator('[data-touch="left"]');
    await expect(fire).toBeVisible();
    await expect(left).toBeVisible();

    // The native canvas height must fit inside the viewport's playable
    // strip — the responsive sizing must NOT push the canvas off-screen
    // on a mobile portrait viewport (the issue's "play correctly one-
    // handed in portrait" requirement).
    const canvasBox = await page.locator("#game").boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThan(200);
    expect(canvasBox!.height).toBeLessThanOrEqual(844);
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.width).toBeLessThanOrEqual(390);

    // Capture spawn position; the engine starts in 'ready'.
    const startX = await page.evaluate(() => window.__galaga!.player.x);

    // Tap FIRE — same intent the Space key dispatches on desktop. First
    // input must flip ready→playing and spawn ONE player bullet.
    await fire.tap();
    await page.waitForFunction(
      () => window.__galaga?.status === "playing",
      null,
      { timeout: 5000 },
    );
    await page.waitForFunction(
      () => (window.__galaga?.bullets ?? []).some((b) => b.from === "player"),
      null,
      { timeout: 3000 },
    );
    const bulletCount = await page.evaluate(
      () =>
        (window.__galaga?.bullets ?? []).filter((b) => b.from === "player")
          .length,
    );
    expect(bulletCount).toBeGreaterThanOrEqual(1);

    // Hold LEFT — pointerdown engages left=true and the ship drifts west.
    // We dispatch a synthetic pointerdown into the LEFT button so the
    // press stays held for a measurable window (page.tap() releases too
    // quickly to observe movement against the 2.4 px/tick speed at
    // 60Hz). Once the ship has moved at least 5px left we release with
    // a pointerup. The touch InputSource listens for both events on the
    // exact element we target here, matching the runtime path.
    await left.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForFunction(
      (sx) => (window.__galaga?.player.x ?? sx) < sx - 5,
      startX,
      { timeout: 5000 },
    );
    await left.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
    });

    const endX = await page.evaluate(() => window.__galaga!.player.x);
    expect(endX).toBeLessThan(startX);
    expect(endX).toBeGreaterThanOrEqual(0);
  } finally {
    await context.close();
  }
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
  // The lifecycle is 'lost' (immediate flip) → 'gameover' (after the brief
  // hold). Either terminal state satisfies "ran out of lives" — the more
  // specific gameover assertion lives in the GAME OVER overlay test above.
  expect(["lost", "gameover"]).toContain(final.status);
});

test("polish VFX: killing an enemy spawns an explosion + a score popup that ages and culls", async ({
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
  await page.waitForFunction(
    () => (window.__galaga?.enemies?.length ?? 0) > 0,
    null,
    { timeout: 10000 },
  );

  // Contract: the polish-state arrays exist on every snapshot (this fails
  // on the pre-change scaffold, which has neither field).
  const baseline = await page.evaluate(() => ({
    explosions: window.__galaga!.explosions,
    scorePopups: window.__galaga!.scorePopups,
  }));
  expect(Array.isArray(baseline.explosions)).toBe(true);
  expect(Array.isArray(baseline.scorePopups)).toBe(true);
  expect(baseline.explosions.length).toBe(0);
  expect(baseline.scorePopups.length).toBe(0);

  // Kill an enemy via the harness AND snapshot the VFX in the SAME evaluate
  // so the rAF loop can't tick between `forceHit`'s synchronous `publish()`
  // and our read. If these were separate `page.evaluate` calls, each round-
  // trip lets rAF age the explosion past 0 — the assertion `age === 0` only
  // holds at the spawning tick. forceHit publishes a fresh snapshot before
  // returning, so reading `window.__galaga` in the next statement of the
  // same evaluate captures that exact snapshot.
  const popped = await page.evaluate(() => {
    window.__galagaInternals!.forceHit({ target: "enemy" });
    return {
      ex: window.__galaga!.explosions[0],
      sp: window.__galaga!.scorePopups[0],
      exLen: window.__galaga!.explosions.length,
      spLen: window.__galaga!.scorePopups.length,
    };
  });
  expect(popped.exLen).toBeGreaterThanOrEqual(1);
  expect(popped.spLen).toBeGreaterThanOrEqual(1);
  expect(popped.ex.age).toBe(0);
  expect(typeof popped.ex.x).toBe("number");
  expect(typeof popped.ex.y).toBe("number");
  expect(popped.sp.value).toBeGreaterThan(0);
  expect(popped.sp.age).toBe(0);

  // VFX must AGE and CULL. After ~1.5s the explosion has outlived its
  // 30-tick lifetime; the score popup outlives its 45-tick lifetime.
  await page.waitForFunction(
    () =>
      (window.__galaga?.explosions?.length ?? 0) === 0 &&
      (window.__galaga?.scorePopups?.length ?? 0) === 0,
    null,
    { timeout: 4000 },
  );
});

test("stage-clear awards hit-miss accuracy bonus by ratio tier (#65)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(
    () => window.__galaga?.status === "playing",
    null,
    { timeout: 5000 },
  );
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });

  // Wait for the entire formation to settle (same gate as the stage-clear
  // test) so `isEmpty()` is true once we kill them all and the stage flips.
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

  // Counters exist on the contract and start at 0 (no real shots fired yet).
  const baseline = await page.evaluate(() => ({
    shots: window.__galaga!.stageShotsFired,
    hits: window.__galaga!.stageHits,
    score: window.__galaga!.score,
    stage: window.__galaga!.stage,
  }));
  expect(baseline.shots).toBe(0);
  expect(baseline.hits).toBe(0);

  // Drive a perfect stage in ONE evaluate so the rAF loop can't race the
  // stage-advance between our forceHit calls and our sample reads. The
  // engine's `forceHit` calls `maybeAdvanceStage` after EACH hit — once
  // the last enemy is removed, that same call awards the bonus and RESETS
  // shotsFired/hits to 0 before we ever get a chance to read them. So we
  // snapshot the counters mid-drain (just before the final kill) AND the
  // post-advance state, all in one evaluate without releasing the JS turn.
  const sample = await page.evaluate(async () => {
    const stageAtStart = window.__galaga!.stage;
    const scoreAtStart = window.__galaga!.score;
    // Drain the formation, but keep one enemy alive so the stage hasn't
    // advanced yet — that's the only window where the mid-stage counters
    // (shotsFired, hits) are still observable as non-zero. The controller
    // can re-emit not-yet-spawned roster members across rAF ticks, so we
    // loop with a small budget and yield to rAF between sweeps.
    let mid: { shots: number; hits: number } | null = null;
    for (let pass = 0; pass < 200; pass++) {
      // Stage already advanced (from a prior pass) → don't touch counters
      // again or we'd overwrite `mid` with the new stage's reset zeros.
      if (window.__galaga!.stage > stageAtStart) break;
      const ids = window.__galaga!.enemies.map((e) => e.id);
      if (ids.length === 0) {
        // No enemies visible this frame but the stage hasn't advanced —
        // the controller still has pending spawns. Yield and try again.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        continue;
      }
      if (ids.length === 1) {
        // Snapshot RIGHT before the last kill — counters are still
        // non-zero and lockstep-equal here, since maybeAdvanceStage
        // hasn't reset them yet (this kill is what will trigger it).
        mid = {
          shots: window.__galaga!.stageShotsFired,
          hits: window.__galaga!.stageHits,
        };
        // The final kill: forceHit → maybeAdvanceStage → bonus + reset
        // + stage++. The next iteration's stage check will exit the loop.
        window.__galagaInternals!.forceHit({
          target: "enemy",
          enemyId: ids[0],
        });
      } else {
        // Kill all but the last enemy this pass — preserves the "one left"
        // sentinel so the next pass takes the snapshot above.
        for (let i = 0; i < ids.length - 1; i++) {
          window.__galagaInternals!.forceHit({
            target: "enemy",
            enemyId: ids[i],
          });
        }
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    return {
      mid,
      stageBefore: stageAtStart,
      scoreBefore: scoreAtStart,
      stageAfter: window.__galaga!.stage,
      scoreAfter: window.__galaga!.score,
      shotsAfter: window.__galaga!.stageShotsFired,
      hitsAfter: window.__galaga!.stageHits,
    };
  });

  // Mid-drain snapshot proves the counters are wired (#65 acceptance #1).
  expect(sample.mid).not.toBeNull();
  expect(sample.mid!.shots).toBeGreaterThan(0);
  // 100% ratio: every forceHit bumped both counters in lockstep.
  expect(sample.mid!.hits).toBe(sample.mid!.shots);

  // Wait for the stage to actually advance (it should already have inside
  // the evaluate, but the guard catches the rare case where the controller
  // re-emitted faster than we drained).
  await page.waitForFunction(
    (prevStage) => (window.__galaga?.stage ?? prevStage) > prevStage,
    sample.stageBefore,
    { timeout: 5000 },
  );

  // Top-tier bonus (>=95%) is 10000; the per-kill score gains are bounded
  // (a few hundred per enemy * roster size sits well under 10000). Assert
  // the bonus landed by checking the cross-stage delta exceeds 10000 on
  // top of the per-kill points.
  expect(sample.scoreAfter - sample.scoreBefore).toBeGreaterThanOrEqual(10000);
  // Counters reset for the next stage.
  expect(sample.shotsAfter).toBe(0);
  expect(sample.hitsAfter).toBe(0);
  expect(sample.stageAfter).toBe(sample.stageBefore + 1);
});

test("challenging stage: no enemy bullets spawn during it and a perfect clear awards a bonus", async ({
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

  // Baseline before the stage starts. The contract's `challenging` flag must
  // default to false — a NORMAL stage must NOT be reported as challenging.
  const before = await page.evaluate(() => ({
    challenging: window.__galaga!.challenging,
    score: window.__galaga!.score,
    stage: window.__galaga!.stage,
  }));
  expect(before.challenging).toBe(false);

  // Force the challenging stage via the harness — same pattern as
  // triggerBossCapture: deterministic, no need to play through N stages.
  await page.evaluate(() =>
    window.__galagaInternals!.startChallengingStage(),
  );

  // Contract #1: state.challenging flips to true.
  await page.waitForFunction(
    () => window.__galaga?.challenging === true,
    null,
    { timeout: 3000 },
  );

  // Contract #2: NO `from:'enemy'` bullets appear at any sample point during
  // the challenging stage. We poll repeatedly across ~3s of wall time, killing
  // every flythrough enemy as it appears so the stage progresses toward a
  // perfect clear. The same pass that proves no enemy fire also drives the
  // perfect-clear preconditions.
  const result = await page.evaluate(async () => {
    let enemyBulletEverSeen = false;
    const stageAtStart = window.__galaga!.stage;
    // Bound the loop: enough frames to outlast the longest entrance arc +
    // descent (~3-4 seconds of game time). The loop exits early once the
    // stage advances away from the challenging stage.
    for (let i = 0; i < 600; i++) {
      const s = window.__galaga!;
      if (s.bullets.some((b) => b.from === "enemy")) {
        enemyBulletEverSeen = true;
      }
      // Kill any enemy on screen — drives toward a perfect clear.
      for (const e of s.enemies) {
        window.__galagaInternals!.forceHit({
          target: "enemy",
          enemyId: e.id,
        });
      }
      // Stage has advanced past the challenging one — we're done.
      if (s.stage > stageAtStart && s.challenging === false) break;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    return {
      enemyBulletEverSeen,
      challenging: window.__galaga!.challenging,
      score: window.__galaga!.score,
      stage: window.__galaga!.stage,
    };
  });

  // Contract #2 assertion: never a single enemy bullet during the stage.
  expect(result.enemyBulletEverSeen).toBe(false);

  // Contract #3: a perfect clear adds a BONUS to score — far more than the
  // sum of per-kill points (each kill adds at most 150 for a boss; the bonus
  // is 10000). We check the score grew by at least 1000 over the pre-stage
  // baseline, which is comfortably above any per-kill accumulation but
  // would FAIL if the bonus path didn't fire.
  expect(result.score).toBeGreaterThan(before.score + 1000);

  // Contract #4: the challenging flag clears once the stage ends.
  expect(result.challenging).toBe(false);
  // And the stage counter advanced — challenging stages count as stages too.
  expect(result.stage).toBeGreaterThan(before.stage);
});
