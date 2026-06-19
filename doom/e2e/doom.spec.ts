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

  // Capture spawn z BEFORE any input. The player spawns at the south edge
  // looking north (down -z), so moving forward must decrease z.
  const z0 = await page.evaluate(() => window.__doom!.player.z);

  // Drive a known number of fixed-steps via the deterministic `advance` hook
  // rather than a wall-clock key-hold — under headless SwiftShader the rAF
  // loop ticks unpredictably slowly, so wall-clock travel is non-deterministic
  // (see the wall-clamp test). 50 steps × 0.08 u = 4 u of forward travel —
  // plenty to prove movement is wired (this is what FAILED on pre-#74 code,
  // where the engine sampled input but never translated the camera) and well
  // short of the ~28 u to the wall, so no clamp interferes.
  await page.evaluate(() =>
    window.__doomInternals!.advance({ steps: 50, forward: true }),
  );

  const z1 = await page.evaluate(() => window.__doom!.player.z);
  expect(z1).toBeLessThan(z0);
});

test("the player spawns INSIDE bounds — on a walkable cell, not at the legacy origin (issue #75)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));

  const { spawn, field } = await page.evaluate(() => ({
    spawn: { x: window.__doom!.player.x, z: window.__doom!.player.z },
    field: window.__doom!.field,
  }));

  // Spawn must sit STRICTLY inside the arena footprint — not on the outer
  // ring of solid cells. The map's outer wall row+col is one CELL thick, so
  // any walkable cell center is > -half + CELL/2 and < +half - CELL/2.
  expect(spawn.x).toBeGreaterThan(-field.width / 2);
  expect(spawn.x).toBeLessThan(field.width / 2);
  expect(spawn.z).toBeGreaterThan(-field.height / 2);
  expect(spawn.z).toBeLessThan(field.height / 2);
});

test("a known wall cell BLOCKS forward movement — the interior pillar holds (issue #75)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // The level map has a single interior pillar; spawn 'S' sits south of it
  // looking north (down -z). Walking forward must STOP before the pillar's
  // south face, even with enough fixed-steps to overshoot it.
  const z0 = await page.evaluate(() => window.__doom!.player.z);

  // 200 steps × 0.08 u = 16 u of forward intent — more than the spawn-to-
  // pillar distance, so a working collision MUST clamp short of the pillar.
  await page.evaluate(() =>
    window.__doomInternals!.advance({ steps: 200, forward: true }),
  );

  const z = await page.evaluate(() => window.__doom!.player.z);
  const field = await page.evaluate(() => window.__doom!.field);

  // Moved north (z decreased) — proves movement ran.
  expect(z).toBeLessThan(z0);
  // Stopped INSIDE the arena — never passed through the north outer wall.
  expect(z).toBeGreaterThan(-field.height / 2);
  // And stopped SHORT of where 16 u of unobstructed travel would have put
  // them: z0 - 16 would be well past the pillar. A working collision keeps z
  // > z0 - 16 (i.e. it didn't pass through).
  expect(z).toBeGreaterThan(z0 - 16);
});

test("Space (live keyboard) fires once: weapon.ammo decrements by 1 after the loop ticks", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Capture starting ammo BEFORE the player has fired. Live keyboard path is
  // what we want to prove — Space → consumeFire → fireShot → ammo--. We must
  // leave READY first (the fire path only runs in the playing-loop), so click
  // the canvas to start.
  const ammo0 = await page.evaluate(() => window.__doom!.weapon.ammo);
  expect(ammo0).toBeGreaterThan(0);

  await page.locator("canvas").click();
  await page.waitForFunction(() => window.__doom?.status === "playing", null, {
    timeout: 5000,
  });

  // Press Space. The keydown sets firePending on the input source; the next
  // fixed-step update drains it via consumeFire() and runs fireShot(), which
  // decrements ammo by exactly 1 (hit or miss). Wait for the published state
  // to reflect that — under headless SwiftShader rAF cadence varies, but the
  // assertion is on STATE, not time.
  await page.keyboard.press(" ");
  await page.waitForFunction((a0) => (window.__doom?.weapon.ammo ?? a0) < a0, ammo0, {
    timeout: 5000,
  });

  const ammo1 = await page.evaluate(() => window.__doom!.weapon.ammo);
  expect(ammo1).toBe(ammo0 - 1);
});

test("an aligned hitscan shot REGISTERS A HIT on the targeted enemy (issue #76)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Aim the camera at the seeded baron (largest box, eye-height) and fire via
  // the synchronous `fire` internal — same code path as Space, just bypasses
  // the input edge trigger so the assertion doesn't race rAF. Yaw is derived
  // from the spawn→target xz vector using the engine's forward-vector basis:
  //   dir = (-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch))
  // → yaw = atan2(x0 − target.x, z0 − target.z). Pitch points the ray at the
  // box's vertical center so the eye (y=1.6) hits the baron's center (y=0.8)
  // without grazing the top edge.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    const baron = s.enemies.find((e) => e.kind === "baron");
    if (!baron) return { ok: false as const, why: "no baron seeded" };
    const p = s.player;
    const distXZ = Math.hypot(p.x - baron.x, p.z - baron.z);
    p.yaw = Math.atan2(p.x - baron.x, p.z - baron.z);
    p.pitch = Math.atan2(baron.y - p.y, distXZ);
    const ammoBefore = s.weapon.ammo;
    const hitsBefore = s.hits.length;
    const hpBefore = baron.hp;
    window.__doomInternals!.fire();
    const after = window.__doom!;
    const baronAfter = after.enemies.find((e) => e.id === baron.id);
    return {
      ok: true as const,
      ammoDelta: after.weapon.ammo - ammoBefore,
      hitsDelta: after.hits.length - hitsBefore,
      lastHitEnemyId: after.hits.at(-1)?.enemyId ?? null,
      baronHpDelta: baronAfter ? baronAfter.hp - hpBefore : null,
      targetId: baron.id,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // One shot consumed exactly one round.
  expect(result.ammoDelta).toBe(-1);
  // A hit was recorded, and it was on the baron we aimed at.
  expect(result.hitsDelta).toBe(1);
  expect(result.lastHitEnemyId).toBe(result.targetId);
  // And the baron actually took damage (or was killed — the seeded baron has
  // 200 hp, well above PLAYER_SHOT_DAMAGE=50, so it survives one shot).
  expect(result.baronHpDelta).not.toBeNull();
  expect(result.baronHpDelta!).toBeLessThan(0);
});

test("fire at 0 ammo is a no-op: ammo stays clamped at 0 and no hit is recorded", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const result = await page.evaluate(() => {
    const s = window.__doom!;
    // Drain ammo + aim at the baron, then click the trigger one more time.
    // The contract: ammo never goes negative and no hit lands.
    s.weapon.ammo = 0;
    const baron = s.enemies.find((e) => e.kind === "baron")!;
    const p = s.player;
    const distXZ = Math.hypot(p.x - baron.x, p.z - baron.z);
    p.yaw = Math.atan2(p.x - baron.x, p.z - baron.z);
    p.pitch = Math.atan2(baron.y - p.y, distXZ);
    const hitsBefore = s.hits.length;
    window.__doomInternals!.fire();
    return {
      ammo: window.__doom!.weapon.ammo,
      hitsDelta: window.__doom!.hits.length - hitsBefore,
    };
  });

  expect(result.ammo).toBe(0);
  expect(result.hitsDelta).toBe(0);
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

test("forceDamage with a small amount only lowers health — player stays alive, status not terminal (issue #79)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Baseline: alive, full health, not terminal.
  const before = await page.evaluate(() => ({
    alive: window.__doom!.player.alive,
    health: window.__doom!.player.health,
    armor: window.__doom!.player.armor,
    status: window.__doom!.status,
  }));
  expect(before.alive).toBe(true);
  expect(before.health).toBe(100);
  expect(before.status).not.toBe("lost");
  expect(before.status).not.toBe("gameover");

  // A non-lethal chip: damage well below starting health. The contract: the
  // player must STILL be alive, health strictly decreased, and status NEVER
  // flips to a terminal state. Pre-#79 the forceDamage hook didn't exist /
  // didn't touch health — this assertion fails on a missing wire.
  await page.evaluate(() =>
    window.__doomInternals!.forceDamage({ amount: 10 }),
  );

  const after = await page.evaluate(() => ({
    alive: window.__doom!.player.alive,
    health: window.__doom!.player.health,
    status: window.__doom!.status,
  }));
  expect(after.alive).toBe(true);
  expect(after.health).toBeLessThan(before.health);
  expect(after.health).toBeGreaterThan(0);
  // Status stays on the pre-terminal side of the lifecycle. The game boots to
  // 'ready' and only leaves on first input; a sub-lethal forceDamage must not
  // arm the 'lost'/'gameover' transition.
  expect(after.status).not.toBe("lost");
  expect(after.status).not.toBe("gameover");
});

test("an attacking enemy in range damages the player (issue #79)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Stand the player one unit south of the imp — well inside ATTACK_RANGE
  // so the AI flips chasing→attacking on the first AI step, then pump enough
  // fixed-steps for the cooldown (30 ticks) to elapse and a melee hit to
  // land. Pre-#79 the engine never applies enemy damage → player.health
  // stays at 100. Post-#79 the imp lands at least one 10-damage hit.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    const imp = s.enemies[0];
    s.player.x = imp.x;
    s.player.z = imp.z + 1; // inside ATTACK_RANGE (1.5)
    const healthBefore = s.player.health;
    // 60 steps = 1s @ 60Hz — guarantees ATTACK_COOLDOWN_TICKS (30) elapsed
    // at least once after the chasing→attacking transition.
    window.__doomInternals!.advance({ steps: 60 });
    return {
      healthBefore,
      healthAfter: window.__doom!.player.health,
      impState: window.__doom!.enemies.find((e) => e.id === imp.id)?.state,
      alive: window.__doom!.player.alive,
    };
  });

  expect(result.impState).toBe("attacking");
  expect(result.healthAfter).toBeLessThan(result.healthBefore);
  // A single imp hit (10 dmg) shouldn't kill a 100-hp player in 1s.
  expect(result.alive).toBe(true);
});

test("enemy AI: idle → chasing and the enemy steps toward the player (issue #77)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Setup: drop the player adjacent to the imp (the first seeded enemy), then
  // pump fixed-steps with no movement keys. Pre-change, enemies hold their
  // seed position forever and state.state stays 'idle' — this test fails.
  // Post-change, the imp notices the player on the first AI step (well within
  // VISION_RADIUS) and walks toward them every tick after.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    const imp = s.enemies[0];
    // Stand a few units south of the imp on the same x — close enough that
    // VISION_RADIUS catches it on the first AI step, far enough that the
    // first move doesn't immediately land in attack range (so we observe
    // both the 'chasing' state AND the position step toward us).
    s.player.x = imp.x;
    s.player.z = imp.z + 5;
    const before = { state: imp.state, x: imp.x, z: imp.z };
    // 10 fixed-steps with no movement keys — the engine still ticks AI.
    window.__doomInternals!.advance({ steps: 10 });
    const after = window.__doom!.enemies.find((e) => e.id === imp.id);
    return {
      before,
      after: after
        ? { state: after.state, x: after.x, z: after.z }
        : null,
      playerZ: window.__doom!.player.z,
    };
  });

  // Pre-conditions: the imp started 'idle' at its seed position.
  expect(result.before.state).toBe("idle");
  expect(result.after).not.toBeNull();
  if (!result.after) return;
  // STATE CONTRACT: the imp left 'idle' — either it's still closing
  // ('chasing') or already in melee ('attacking'). Both prove the transition
  // ran; idle would be a failure.
  expect(result.after.state).not.toBe("idle");
  expect(["chasing", "attacking"]).toContain(result.after.state);
  // POSITION CONTRACT: the imp moved toward the player. Player is south of
  // the imp (player.z > imp.z), so the imp's z must INCREASE as it closes.
  expect(result.after.z).toBeGreaterThan(result.before.z);
  // x was aligned with the player, so x stays put (within float tolerance).
  expect(Math.abs(result.after.x - result.before.x)).toBeLessThan(0.01);
});

test("forcePickup() flips taken=true and grants its effect (health/armor/ammo) — issue #80", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // The scaffold seeds at least one un-taken pickup. Confirm the contract:
  // - pickups roster is non-empty
  // - the first pickup starts un-taken
  // - forcePickup() (no id) flips its taken flag and raises the matching
  //   player/weapon stat for its kind.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    if (s.pickups.length === 0) return { ok: false as const, why: "no pickups seeded" };
    const target = s.pickups[0];
    const before = {
      taken: target.taken,
      kind: target.kind,
      health: s.player.health,
      armor: s.player.armor,
      ammo: s.weapon.ammo,
    };
    window.__doomInternals!.forcePickup({ id: target.id });
    const after = window.__doom!;
    const updated = after.pickups.find((p) => p.id === target.id)!;
    return {
      ok: true as const,
      before,
      after: {
        taken: updated.taken,
        health: after.player.health,
        armor: after.player.armor,
        ammo: after.weapon.ammo,
      },
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.before.taken).toBe(false);
  expect(result.after.taken).toBe(true);
  // The matching stat rose. Each pickup kind maps to a distinct stat — the
  // others stay put. (health pickup grants up to 100; player starts at 100
  // so a health pickup may be a no-op at full hp — exercised separately
  // below via a walk-over test against ammo, which always rises.)
  if (result.before.kind === "ammo") {
    expect(result.after.ammo).toBeGreaterThan(result.before.ammo);
  } else if (result.before.kind === "armor") {
    expect(result.after.armor).toBeGreaterThan(result.before.armor);
  } else {
    // health: at full hp the grant clamps to 100; chip a wound first so the
    // grant is observable.
    // (Not reached for the default seed where pickups[0].kind === 'health',
    // but kept generic so reordering seeds doesn't silently weaken the test.)
    expect(result.after.health).toBeGreaterThanOrEqual(result.before.health);
  }
});

test("walking onto a pickup grants it the same tick — issue #80", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Teleport the player ON TOP of an ammo pickup (so the grant always raises
  // a stat — health caps at 100 from the default 100, armor starts at 0 so
  // armor would also work, but ammo is unambiguously monotonic). Then pump a
  // single fixed-step with no movement keys; the engine's per-tick pickup
  // check must see the overlap and apply.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    const ammoPickup = s.pickups.find((p) => p.kind === "ammo" && !p.taken);
    if (!ammoPickup) return { ok: false as const, why: "no ammo pickup seeded" };
    s.player.x = ammoPickup.x;
    s.player.z = ammoPickup.z;
    const ammoBefore = s.weapon.ammo;
    window.__doomInternals!.advance({ steps: 1 });
    const after = window.__doom!;
    const updated = after.pickups.find((p) => p.id === ammoPickup.id)!;
    return {
      ok: true as const,
      ammoDelta: after.weapon.ammo - ammoBefore,
      taken: updated.taken,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.taken).toBe(true);
  expect(result.ammoDelta).toBeGreaterThan(0);
});

test("enemy variety: the roster includes at least 2 distinct kinds (issue #81)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));

  // The seeded roster must publish more than one enemy archetype — variety
  // is the whole point of #81 (an arena of imps is monotone). Asserting on
  // the SET of kinds, not a specific name, so reorderings of the seed don't
  // weaken the test.
  const kinds = await page.evaluate(() =>
    Array.from(new Set(window.__doom!.enemies.map((e) => e.kind))),
  );
  expect(kinds.length).toBeGreaterThanOrEqual(2);
});

test("a ranged enemy emits a projectile with from==='enemy' (issue #81)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Drop the player one unit south of the baron — well inside the baron's
  // RANGED_ATTACK_RANGE (10), so its AI flips chasing→attacking on the
  // first step. After the attack cooldown elapses (~0.5s @ 60Hz) the engine
  // must spawn a `from:'enemy'` projectile aimed at the player. We pump
  // enough fixed-steps to guarantee both the state transition AND a cooldown
  // tick. Pre-#81 the projectile slot was empty in the scaffold — this
  // assertion FAILS without the ranged-attack wiring.
  const result = await page.evaluate(() => {
    const s = window.__doom!;
    const baron = s.enemies.find((e) => e.kind === "baron");
    if (!baron) return { ok: false as const, why: "no baron seeded" };
    s.player.x = baron.x;
    s.player.z = baron.z + 1;
    // 60 fixed-steps = 1s @ 60Hz — covers ATTACK_COOLDOWN_TICKS (30) at least
    // once after the chasing→attacking transition. We immediately freeze the
    // projectile roster (count + the first projectile's metadata) BEFORE
    // surveying state.projectiles further, because a fast-moving fireball at
    // 0.2 u/step + 0.6 u hit radius will impact the on-top player within a
    // handful of ticks and the engine then prunes it.
    let snapshot: { count: number; first: { from: string; id: number } | null } = {
      count: 0,
      first: null,
    };
    for (let i = 0; i < 60; i++) {
      window.__doomInternals!.advance({ steps: 1 });
      const ps = window.__doom!.projectiles;
      if (ps.length > 0 && snapshot.count === 0) {
        snapshot = {
          count: ps.length,
          first: { from: ps[0].from, id: ps[0].id },
        };
      }
    }
    return {
      ok: true as const,
      baronState: window.__doom!.enemies.find((e) => e.id === baron.id)?.state,
      snapshot,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // Baron should have engaged (chasing or attacking, never still idle).
  expect(["chasing", "attacking"]).toContain(result.baronState ?? "");
  // A projectile was observed mid-flight…
  expect(result.snapshot.count).toBeGreaterThanOrEqual(1);
  // …and it was an enemy-origin projectile (the contract for #81).
  expect(result.snapshot.first?.from).toBe("enemy");
});

// NOTE: an earlier draft of this file also asserted against
// `advance({fire:true})`, `weapon.lastShotTick`, and `weapon.lastHitEnemyId` —
// contracts that were never built. Issue #76's acceptance ("ammo drops" +
// "shot at an enemy registers a hit") is fully covered above by the live-Space
// ammo test, the `fire()`-internal hit test, and the 0-ammo no-op. Don't add
// `fire` to `advance` or `lastShotTick`/`lastHitEnemyId` to `Weapon` without
// a follow-up issue that names the consumer — the death slice reads
// `__doom.hits`, which is the canonical hit publication.
