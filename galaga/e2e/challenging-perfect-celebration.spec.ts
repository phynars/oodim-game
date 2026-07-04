import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";
import {
  CHALLENGING_PERFECT_BONUS,
  HEIGHT,
  SPARK_LIFETIME_KILL_TICKS,
  WIDTH,
} from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

test("perfect challenging clear adds center bonus popup + deterministic 16-spark fanfare and preserves perfect banner/stage flow (#382)", async ({
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

  const perfect = await page.evaluate(async () => {
    const beforeStage = window.__galaga!.stage;
    const beforeScore = window.__galaga!.score;

    window.__galagaInternals!.startChallengingStage();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    for (let i = 0; i < 300; i++) {
      const enemies = window.__galaga?.enemies ?? [];
      if (enemies.length === 0) break;
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: enemies[0].id,
      });
      if ((window.__galaga?.stage ?? beforeStage) > beforeStage) break;
      if ((window.__galaga?.enemies ?? []).length > 0) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }

    const s = window.__galaga!;
    const bonusPopups = s.scorePopups.filter(
      (p) =>
        p.value === CHALLENGING_PERFECT_BONUS &&
        Math.abs(p.x - WIDTH / 2) < 0.001 &&
        Math.abs(p.y - (HEIGHT / 2 + 54)) < 0.001,
    );

    return {
      beforeStage,
      beforeScore,
      stage: s.stage,
      tick: s.tick,
      score: s.score,
      perfectBanner: window.__galagaInternals!.getPerfectBanner(),
      missBanner: window.__galagaInternals!.getMissBanner(),
      bonusPopups,
      sparks: s.feedback.sparks.map((sp) => ({
        x: sp.x,
        y: sp.y,
        vx: sp.vx,
        vy: sp.vy,
        ageTicks: sp.ageTicks,
        lifetimeTicks: sp.lifetimeTicks,
      })),
    };
  });

  expect(perfect.stage).toBeGreaterThan(perfect.beforeStage);
  expect(perfect.missBanner).toBeNull();
  expect(perfect.perfectBanner).not.toBeNull();
  expect(perfect.perfectBanner!.bonus).toBe(CHALLENGING_PERFECT_BONUS);
  expect(perfect.perfectBanner!.until - perfect.tick).toBe(90);

  expect(perfect.bonusPopups).toHaveLength(1);

  expect(perfect.sparks).toHaveLength(16);
  for (const sp of perfect.sparks) {
    expect(sp.ageTicks).toBe(0);
    expect(sp.lifetimeTicks).toBe(SPARK_LIFETIME_KILL_TICKS);
  }

  const expected = Array.from({ length: 16 }, (_, i) => {
    const pair = Math.floor(i / 2);
    const lane = i % 2 === 0 ? -1 : 1;
    const spread = pair / 7;
    const jitter =
      (((Math.sin(perfect.tick * 53.171 + i * 19.19) * 43758.5453) % 1) + 1) %
      1;
    const angle =
      -Math.PI / 2 + lane * (0.2 + spread * 0.9) + (jitter - 0.5) * 0.16;
    const speed = 1.2 + jitter * 1.6;
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2 + 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  });

  for (let i = 0; i < expected.length; i++) {
    expect(perfect.sparks[i]!.x).toBeCloseTo(expected[i]!.x, 8);
    expect(perfect.sparks[i]!.y).toBeCloseTo(expected[i]!.y, 8);
    expect(perfect.sparks[i]!.vx).toBeCloseTo(expected[i]!.vx, 8);
    expect(perfect.sparks[i]!.vy).toBeCloseTo(expected[i]!.vy, 8);
  }

  await page.waitForFunction(
    ({ startTick }) => (window.__galaga?.tick ?? 0) >= startTick + 120,
    { startTick: perfect.tick },
    { timeout: 5000 },
  );
  const postHold = await page.evaluate(() => window.__galaga!.score);
  expect(postHold).toBe(perfect.score);
  expect(perfect.score - perfect.beforeScore).toBeGreaterThanOrEqual(
    CHALLENGING_PERFECT_BONUS,
  );
});

test("non-perfect challenging exit keeps HIT banner behavior and does not spawn perfect celebration burst (#382)", async ({
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

  const pre = await page.evaluate(() => {
    window.__galagaInternals!.startChallengingStage();
    return {
      stage: window.__galaga!.stage,
      score: window.__galaga!.score,
    };
  });

  await page.waitForFunction(
    (stage) => (window.__galaga?.stage ?? stage) > stage,
    pre.stage,
    { timeout: 20000 },
  );

  const post = await page.evaluate(() => {
    const s = window.__galaga!;
    return {
      score: s.score,
      perfectBanner: window.__galagaInternals!.getPerfectBanner(),
      missBanner: window.__galagaInternals!.getMissBanner(),
      sparks: s.feedback.sparks.length,
      centeredBonusPopups: s.scorePopups.filter(
        (p) =>
          p.value === CHALLENGING_PERFECT_BONUS &&
          Math.abs(p.x - WIDTH / 2) < 0.001 &&
          Math.abs(p.y - (HEIGHT / 2 + 54)) < 0.001,
      ).length,
    };
  });

  expect(post.score).toBe(pre.score);
  expect(post.perfectBanner).toBeNull();
  expect(post.missBanner).not.toBeNull();
  expect(post.missBanner!.count).toBeGreaterThan(0);
  expect(post.sparks).toBe(0);
  expect(post.centeredBonusPopups).toBe(0);
});
