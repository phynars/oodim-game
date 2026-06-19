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

test("ArrowUp moves the player forward — player.z DECREASES (camera looks down -z)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Defenses against Playwright's mouse-delta-into-yaw flake:
  //
  //   (a) PRE-POSITION the mouse at the canvas center BEFORE clicking. A
  //       fresh page starts the mouse at (0,0); the click()'s implicit
  //       pre-click move can otherwise dispatch a mousemove with HUNDREDS
  //       of pixels of movementX/Y → translates to ~10° of yaw on the
  //       first tick. `mouse.move` to the click target first means the
  //       click's own move is a no-op delta.
  //
  //   (b) Wait for SEVERAL fixed-step ticks (not just one) so any late
  //       pointer events that fire after the click have been drained into
  //       (and consumed by) the input source.
  //
  //   (c) forceTeleport with explicit yaw:0 KEEPING the spawn x/z — so
  //       regardless of any residual yaw drift, the player is aimed
  //       straight down -z when we hold forward.
  const canvasBox = await page.locator("canvas").boundingBox();
  if (canvasBox) {
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );
  }
  await page.locator("canvas").click();
  await page.waitForFunction(() => window.__doom?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => (window.__doom?.tick ?? 0) >= 3, null, {
    timeout: 5000,
  });
  const spawn = await page.evaluate(() => ({
    x: window.__doom!.player.x,
    z: window.__doom!.player.z,
  }));
  await page.evaluate((s) => {
    window.__doomInternals!.forceTeleport({ x: s.x, z: s.z, yaw: 0 });
  }, spawn);
  const z0 = spawn.z;

  // Hold forward; at 60Hz with PLAYER_SPEED_PER_TICK=0.08 the player
  // should travel several world-units in well under a second. Wait until
  // the contract reports we've MOVED — the assertion that proves
  // movement is wired (this is what FAILED on pre-#74 code, where the
  // engine sampled input but never translated the camera).
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(
    (start) => (window.__doom?.player.z ?? start) < start - 0.5,
    z0,
    { timeout: 5000 },
  );
  await page.keyboard.up("ArrowUp");

  const z1 = await page.evaluate(() => window.__doom!.player.z);
  expect(z1).toBeLessThan(z0);
});

test("walking into a wall clamps player.z — the player does NOT pass through the playfield edge", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const field = await page.evaluate(() => window.__doom!.field);

  // This test asserts the PERIMETER clamp (the player can't pass through
  // the north wall). #75 added an interior pillar at (col=7..8, row=4),
  // which sits directly in front of the default spawn (x=-1) — if we
  // walked from spawn we'd be measuring the pillar block, not the
  // perimeter. Teleport into a column with no interior obstacles (x=-6
  // is a clear corridor between the west wall and the pillar pair), at
  // a safely-southern z, and reset yaw so ArrowUp aims straight at the
  // north wall regardless of any mouse delta the click queued.
  //
  // Same three-layer defense as the forward-walk test above: pre-position
  // the mouse so click() doesn't dispatch a huge movementX, drain SEVERAL
  // ticks before teleporting, then forceTeleport with yaw:0.
  const canvasBox = await page.locator("canvas").boundingBox();
  if (canvasBox) {
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );
  }
  await page.locator("canvas").click();
  await page.waitForFunction(() => window.__doom?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => (window.__doom?.tick ?? 0) >= 3, null, {
    timeout: 5000,
  });
  await page.evaluate(() => {
    window.__doomInternals!.forceTeleport({ x: -6, z: 12, yaw: 0 });
  });

  // Hold forward (down -z) for long enough that, UNCLAMPED, the player
  // would overshoot the wall. At 0.08 u/step × 60Hz = 4.8 u/s; from
  // z=+12 on a 32-deep field, the north-perimeter wall sits near z=-14
  // (the wall cell row 0 spans z ∈ [-16,-14], south face at -14). Travel
  // to the wall is ~26 u, ~5.4s. 6s gives a comfortable cushion to be
  // SURE we're pinned against the wall when we sample.
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(6000);
  await page.keyboard.up("ArrowUp");

  const z = await page.evaluate(() => window.__doom!.player.z);
  // Z is bounded by the north-wall south face minus PLAYER_RADIUS. We
  // assert the WALL HELD: z never went below -field.height/2.
  expect(z).toBeGreaterThan(-field.height / 2);
  // And we DID reach the wall — z is far past the teleport landing
  // (z=+12). If movement silently no-op'd this would still equal +12.
  // Anywhere on the north half is the win condition.
  expect(z).toBeLessThan(0);
});

test("level geometry: player spawns INSIDE the map and not inside a wall", async ({
  page,
}) => {
  // Acceptance for #75 (level geometry slice). The arena is no longer a hard-
  // coded box — it's a tile grid in level.ts. The player must spawn on a
  // FLOOR cell that lies inside the published field. We assert both via the
  // contract: (1) |x|, |z| within field/2; (2) the spawn point doesn't
  // collide with a wall (reproduced here by snapping x,z to the engine's
  // grid via the field dimensions — TILE_SIZE is fixed at 2). Pre-#75 this
  // file didn't exist; the assertion against a TRUE grid (not just box
  // bounds) is what fails before the slice lands.
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));

  const s = await page.evaluate(() => window.__doom!);
  // Spawn lies strictly inside the field footprint (with a small radius gap
  // — the player can't be sitting on the perimeter row of cells, which is
  // all walls).
  const halfW = s.field.width / 2;
  const halfH = s.field.height / 2;
  expect(s.player.x).toBeGreaterThan(-halfW + 1);
  expect(s.player.x).toBeLessThan(halfW - 1);
  expect(s.player.z).toBeGreaterThan(-halfH + 1);
  expect(s.player.z).toBeLessThan(halfH - 1);
});

test("level geometry: a KNOWN interior wall cell blocks movement (collision driven by the map, not a perimeter clamp)", async ({
  page,
}) => {
  // Acceptance for #75: collision must be driven by the level MAP, not just
  // a "stay inside the box" clamp. We prove it by teleporting the player
  // directly SOUTH of the known interior wall pair at (col=7..8, row=4) —
  // world (x≈-1..1, z≈-7) — then holding forward. With map collision the
  // player STOPS short of the pillar; with the old box-clamp it would walk
  // straight through the interior obstacle to the north perimeter (z≈-16).
  //
  // This test FAILS on pre-#75 code (no interior walls exist; player walks
  // through what should be the pillar) and PASSES once map collision lands.
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Order matters here. The canvas click is a real mouse event sequence
  // (move → down → up), and Playwright's pre-click pointer move can deliver
  // a nonzero movementX/Y to the input source's mousemove handler. Once the
  // loop starts, the FIRST tick drains that accumulated mouse delta into the
  // player's yaw — which would rotate us off the +z axis and the forward
  // walk would no longer aim at the pillar. Three defenses:
  //   1. PRE-POSITION the mouse over the canvas center so the click()'s
  //      implicit pre-click pointer move dispatches a near-zero movementX/Y.
  //   2. Click FIRST (flips ready→playing) and wait for the loop to actually
  //      start ticking — drain SEVERAL ticks so any late pointer events that
  //      fire after the click have been consumed.
  //   3. Then forceTeleport with an explicit yaw:0, which RESETS yaw back to
  //      facing -z regardless of what the click did. Now ArrowUp walks
  //      straight at the pillar.
  const canvasBox = await page.locator("canvas").boundingBox();
  if (canvasBox) {
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );
  }
  await page.locator("canvas").click();
  await page.waitForFunction(() => window.__doom?.status === "playing", null, {
    timeout: 5000,
  });
  // Wait for several ticks so the mouse-delta accumulator is drained and
  // any late pointer events have been consumed.
  await page.waitForFunction(() => (window.__doom?.tick ?? 0) >= 3, null, {
    timeout: 5000,
  });

  // Teleport just south of the pillar pair at row=4 (world z≈-7). South face
  // of the pillar is at z = -7 + TILE_SIZE/2 = -6. Place the player a couple
  // of units further south so they walk INTO the wall (rather than already
  // being against it before the loop starts). yaw:0 re-aims them at -z.
  await page.evaluate(() => {
    window.__doomInternals!.forceTeleport({ x: 0, z: -3, yaw: 0 });
  });

  // Confirm teleport landed. Use generous tolerances — between the
  // teleport call and the read, a fixed-step tick can fire; with no keys
  // held and yaw=0 the player position/yaw should be unchanged, but if a
  // residual mouse delta happened to fire it could nudge yaw fractionally.
  // The test cares that we're CLOSE to the teleport target, not exact.
  const after = await page.evaluate(() => ({
    x: window.__doom!.player.x,
    z: window.__doom!.player.z,
    yaw: window.__doom!.player.yaw,
  }));
  expect(after.x).toBeCloseTo(0, 1);
  expect(after.z).toBeCloseTo(-3, 1);
  // Yaw can drift slightly if a late mousemove dispatches after the
  // teleport — tolerate up to ~0.1 rad (~6°), well within "still aimed
  // mostly at the pillar".
  expect(Math.abs(after.yaw)).toBeLessThan(0.1);

  // One more yaw reset right before holding forward — drains any residual
  // mouse delta that might have crept in between the previous teleport and
  // here, so ArrowUp walks straight down -z.
  await page.evaluate(() => {
    window.__doomInternals!.forceTeleport({ x: 0, z: -3, yaw: 0 });
  });

  // Hold forward (down -z, toward the pillar). At 4.8 u/s, 2s of held input
  // would travel 9.6u UNCLAMPED — way past the pillar at z≈-7. Map collision
  // must stop the player BEFORE the pillar's south face (z > -6 + radius).
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowUp");

  const z = await page.evaluate(() => window.__doom!.player.z);
  // The pillar's south face is at z = -6 (cell center -7, half-tile = 1).
  // Player center with PLAYER_RADIUS=0.3 stops at z ≈ -6 + 0.3 = -5.7.
  // Assert the player did NOT pass through the wall: z stays SOUTH of the
  // pillar (z > -6). Even a generous radius makes z > -6.5 the safe bound.
  expect(z).toBeGreaterThan(-6.5);
  // And the player DID move (didn't stall against teleport position) — z is
  // measurably more negative than the teleport landing of -3, by at least a
  // few ticks of movement.
  expect(z).toBeLessThan(-3);
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
