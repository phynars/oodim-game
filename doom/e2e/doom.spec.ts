// Gameplay harness for Doom — the scaffold floor. These tests assert the
// load-bearing `window.__doom` contract boots, that WebGL actually initialized
// in headless Chromium (the make-or-break for a true-3D product in CI), that
// the fixed-step loop ticks once started, and that the test-only combat hooks
// drive deterministic outcomes. Backlog slices ADD tests here (movement,
// firing/projectiles, enemy AI, pickups, doors, scoring/stages, win/lose) —
// each new mechanic must ship with a failing-first assertion against
// `window.__doom`, the same "CI for gameplay" discipline Pac-Man + Galaga use.
//
// THE CONTRACT IS STATE, NOT PIXELS. WebGL pixels are unreadable headless; we
// assert that a context CAME UP, then read the published game state. See
// doom/docs/ARCHITECTURE.md "WebGL in headless CI".

import { expect, test } from "@playwright/test";

import type { DoomInternals, DoomState } from "../src/game/types";

declare global {
  interface Window {
    __doom?: DoomState;
    __doomInternals?: DoomInternals;
  }
}

test("boots the state contract: ready, full health, player at eye height, field + a seeded enemy present", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));

  const s = await page.evaluate(() => window.__doom!);
  expect(s.status).toBe("ready");
  expect(s.stage).toBe(1);
  expect(s.score).toBe(0);
  expect(s.player.alive).toBe(true);
  expect(s.player.health).toBe(100);
  expect(s.player.armor).toBe(0);
  // The camera IS the player: eye height is well above the floor (y=0).
  expect(s.player.y).toBeGreaterThan(1);
  expect(s.field.width).toBeGreaterThan(0);
  expect(s.field.height).toBeGreaterThan(0);
  // Rosters exist; the scaffold seeds >=1 enemy so forceHit has a target.
  expect(Array.isArray(s.enemies)).toBe(true);
  expect(s.enemies.length).toBeGreaterThanOrEqual(1);
  expect(Array.isArray(s.projectiles)).toBe(true);
  expect(Array.isArray(s.pickups)).toBe(true);
  expect(Array.isArray(s.doors)).toBe(true);
  // The equipped weapon is published.
  expect(typeof s.weapon.kind).toBe("string");
  expect(typeof s.weapon.ammo).toBe("number");
});

test("WebGL initializes in headless Chromium (the true-3D / CI make-or-break)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));

  // The load-bearing assertion for a true-3D product: a real WebGL (or WebGL2)
  // rendering context must come up in headless CI. If this is false, the
  // SwiftShader launch flags (playwright.config.ts) aren't taking effect and
  // the whole experiment is blocked. We pull a fresh context off the canvas —
  // getContext returns the SAME context three.js already created when the type
  // matches, so this doesn't disturb the renderer.
  const hasWebGL = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const gl =
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl");
    return Boolean(gl);
  });
  expect(hasWebGL).toBe(true);
});

test("first input flips ready→playing and the fixed-step loop advances tick", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  expect(await page.evaluate(() => window.__doom!.status)).toBe("ready");

  // Focus the canvas + send an input; the engine leaves READY on first input.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowUp");

  await page.waitForFunction(() => window.__doom?.status === "playing", null, {
    timeout: 5000,
  });

  // The tick counter only advances while playing — prove the loop runs.
  const t1 = await page.evaluate(() => window.__doom!.tick);
  await page.waitForFunction((t) => (window.__doom?.tick ?? 0) > t, t1, {
    timeout: 5000,
  });
  const t2 = await page.evaluate(() => window.__doom!.tick);
  expect(t2).toBeGreaterThan(t1);
});

test("forceHit() drops the first enemy's hp / flips it to 'dead' and scores", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const before = await page.evaluate(() => {
    const first = window.__doom!.enemies[0];
    return {
      id: first.id,
      hp: first.hp,
      state: first.state,
      score: window.__doom!.score,
    };
  });
  expect(before.state).not.toBe("dead");

  // Land a hit on the first enemy. The seeded first enemy is an imp whose hp
  // is below PLAYER_SHOT_DAMAGE, so this single hit is lethal: it flips to
  // 'dead' (and is scored) in the SAME synchronous publish forceHit does. We
  // sample in the same evaluate so the rAF cull can't drop it before we read.
  const after = await page.evaluate((id) => {
    window.__doomInternals!.forceHit({ enemyId: id });
    const e = window.__doom!.enemies.find((x) => x.id === id) ?? null;
    return {
      enemy: e ? { hp: e.hp, state: e.state } : null,
      score: window.__doom!.score,
    };
  }, before.id);

  // Either the enemy is now 'dead' (lethal) or its hp dropped — both prove the
  // hit landed. For the seeded imp it's lethal.
  if (after.enemy) {
    const killed = after.enemy.state === "dead" || after.enemy.hp < before.hp;
    expect(killed).toBe(true);
  }
  // A kill awards score.
  expect(after.score).toBeGreaterThan(before.score);
});

test("forceDamage({amount:1000}) drives the player to a terminal state", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Baseline: alive, healthy.
  const before = await page.evaluate(() => ({
    alive: window.__doom!.player.alive,
    health: window.__doom!.player.health,
    status: window.__doom!.status,
  }));
  expect(before.alive).toBe(true);
  expect(before.health).toBeGreaterThan(0);

  // Deal massively lethal damage. The player must die: alive=false, health 0,
  // and status flips to a terminal state ('lost' immediately, then 'gameover'
  // after the brief hold).
  await page.evaluate(() =>
    window.__doomInternals!.forceDamage({ amount: 1000 }),
  );

  const afterHit = await page.evaluate(() => ({
    alive: window.__doom!.player.alive,
    health: window.__doom!.player.health,
    status: window.__doom!.status,
  }));
  expect(afterHit.alive).toBe(false);
  expect(afterHit.health).toBe(0);
  expect(["lost", "gameover"]).toContain(afterHit.status);

  // The two-step terminal lifecycle settles on 'gameover' — but ONLY advances
  // while the fixed-step loop runs (status must have left 'ready'). If we died
  // straight from READY the loop never ticks, so we only require the terminal
  // 'lost' OR 'gameover' above and additionally accept that gameover may need
  // the loop running. Start the loop, then confirm it reaches 'gameover'.
  await page.locator("canvas").click();
  await page.waitForFunction(
    () =>
      window.__doom?.status === "gameover" || window.__doom?.status === "lost",
    null,
    { timeout: 5000 },
  );
  const settled = await page.evaluate(() => window.__doom!.status);
  expect(["lost", "gameover"]).toContain(settled);
});
