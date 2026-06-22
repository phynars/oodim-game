// Issue #224 — house-release emerge envelope.
//
// When a ghost's dot-counter threshold is crossed, the engine flips its
// status from "house" → "out" and warps it to the lip tile (13, 11).
// Pre-#224 this was a hard pop: the ghost simply appeared on screen.
// #224 adds a pure-data emerge envelope (`emergeProgress`, 0→1 over 18
// ticks) that the renderer maps through an ease-out-cubic alpha + scale.
//
// What this spec asserts (load-bearing contract — pixel-free, pure
// `window.__pac` reads):
//
//   • Blinky boots already "out" with `emergeProgress === 1` — no fade
//     on the initial roster spawn (the issue is purely the dot-counter
//     promotion, NOT the boot).
//   • The tick Pinky is released (dot counter >= 7), the published
//     `emergeProgress` reads near 0 (< 0.1 — the spec accepts a small
//     band because the publish-step decay lands a tick AFTER the arm in
//     the same update call).
//   • The ghost is at the expected lip tile (13, 11) with mode "scatter"
//     and the arm-side movement primitives we keep stable per the spec
//     (the rest of the test contract — name + tile coords + mode — is
//     covered by pacman.spec.ts; we don't redo it here).
//   • Exactly 18 update ticks after release, `emergeProgress === 1` and
//     the ghost is moving normally. We poll by tick gap rather than by
//     wall time so the assertion is fps-independent and CI-stable.

import { expect, test } from "@playwright/test";

import type { GameState } from "../../src/game/types";

declare global {
  interface Window {
    __pac?: GameState;
  }
}

test("Blinky boots with emergeProgress === 1 — no fade on initial spawn", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  // Snapshot the published roster immediately; we don't need the sim to
  // tick — the engine publishes once during construction.
  const blinky = await page.evaluate(() => {
    const s = window.__pac!;
    const b = s.ghosts.find((g) => g.name === "blinky");
    return b ? { name: b.name, emergeProgress: b.emergeProgress } : null;
  });
  expect(blinky).not.toBeNull();
  expect(blinky!.emergeProgress).toBe(1);
});

test("Pinky house-release arms the emerge envelope, settles in 18 ticks", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  // Pre-release sanity: Pinky should NOT yet be emerging. She boots
  // inside the house at (13, 14) — _emergeTicks=0 → emergeProgress=1.
  // (`emergeProgress` semantics: "1 = settled or never armed". A ghost
  // still in the house publishes 1; only the tick of promotion arms
  // the envelope down to ~0.)
  const beforeRelease = await page.evaluate(() => {
    const s = window.__pac!;
    const p = s.ghosts.find((g) => g.name === "pinky");
    return p ? { x: p.x, y: p.y, mode: p.mode, emergeProgress: p.emergeProgress } : null;
  });
  expect(beforeRelease).not.toBeNull();
  expect(beforeRelease!.emergeProgress).toBe(1);

  // Drive Pac east-then-back to eat enough pellets to cross Pinky's
  // threshold (7). From spawn (13, 23), the row [..., 13, 14, 15, ...]
  // is the bottom corridor — ArrowLeft alone eats pellets continuously.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");

  // Atomic poll: wait for Pinky's emergeProgress to drop below 0.1 — the
  // signature of the arm having landed within the last tick. We snapshot
  // tick + Pinky's view inside the predicate so a slow rAF poll can't
  // skip past the arm tick.
  const armed = await page.waitForFunction(
    () => {
      const s = window.__pac;
      if (!s) return null;
      const p = s.ghosts.find((g) => g.name === "pinky");
      if (!p) return null;
      // 1 means "still in the house" OR "fully settled" — both are
      // "not arming right now"; keep waiting.
      if (p.emergeProgress >= 1) return null;
      return {
        tick: s.tick,
        x: p.x,
        y: p.y,
        mode: p.mode,
        emergeProgress: p.emergeProgress,
        pelletsRemaining: s.pellets,
      };
    },
    null,
    { timeout: 15_000 },
  );
  const armedSnap = (await armed.jsonValue()) as {
    tick: number;
    x: number;
    y: number;
    mode: string;
    emergeProgress: number;
    pelletsRemaining: number;
  };

  // The release-tick band. The decay runs once per tick AFTER the arm
  // in the same update call, so the first published value is
  // 1 - 17/18 ≈ 0.0556. We accept anything under 0.1 to absorb a one-
  // tick polling gap (worst case 1 - 16/18 ≈ 0.111 — out of band, but
  // that would mean we missed two ticks, which is rare on a healthy
  // CI). Floor at 0 because emergeProgress is never published negative.
  expect(armedSnap.emergeProgress).toBeGreaterThanOrEqual(0);
  expect(armedSnap.emergeProgress).toBeLessThan(0.1);
  // The release block warps Pinky to the lip tile (13, 11) with mode
  // "scatter" (the boot mode — the chase phase doesn't start until tick
  // 300, and the release fires well before that on the bottom corridor).
  expect(armedSnap.x).toBe(13);
  expect(armedSnap.y).toBe(11);
  expect(armedSnap.mode).toBe("scatter");

  // Now wait for the envelope to settle. The decay is linear: one tick
  // per update, total EMERGE_TICKS=18 ticks from arm → 1.0. We give a
  // generous timeout to absorb the rAF cadence and any incidental
  // hitstop / death gates (none expected, but the gate would only pause
  // the decay, not skip it).
  const settled = await page.waitForFunction(
    () => {
      const s = window.__pac;
      if (!s) return null;
      const p = s.ghosts.find((g) => g.name === "pinky");
      if (!p) return null;
      if (p.emergeProgress < 1) return null;
      return { tick: s.tick, emergeProgress: p.emergeProgress };
    },
    null,
    { timeout: 5000 },
  );
  const settledSnap = (await settled.jsonValue()) as {
    tick: number;
    emergeProgress: number;
  };

  expect(settledSnap.emergeProgress).toBe(1);
  // 18 ticks between the first armed read and the settled read is the
  // arithmetic ideal (1/18 → ... → 18/18). In practice the armed-read
  // may have caught the first tick after arming (so we're already at
  // ~1/18), and the settled-read may land on the exact 18/18 tick or
  // one tick after — accept a small +/- band so the test isn't brittle
  // to which tick the predicate happened to fire on.
  const elapsed = settledSnap.tick - armedSnap.tick;
  expect(elapsed).toBeGreaterThanOrEqual(16);
  expect(elapsed).toBeLessThanOrEqual(20);
});

test("eaten→revive does NOT re-arm the emerge envelope", async ({ page }) => {
  // The eyes-glide back to the house is already smooth (EATEN_SPEED_PER_TICK
  // = 0.20/tick — see ghost-glide.spec.ts). Per #224 scope, eaten→revive
  // must NOT re-arm `_emergeTicks` — we'd visually re-fade a ghost that
  // just smoothly glided back, which would regress the eyes feel.
  //
  // We force Blinky into "eaten" mode via the test hook and then poll a
  // window of ticks while she races home. Blinky's `emergeProgress` must
  // remain 1 throughout (she boots already-out and never enters the
  // house-release path).
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(
    () => Boolean((window as unknown as { __pacInternals?: unknown }).__pacInternals),
  );

  // Unfreeze the sim (issue #8 — update() gates on first input).
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  await page.evaluate(() => {
    (
      window as unknown as {
        __pacInternals: { setGhostEaten: (n: "blinky") => void };
      }
    ).__pacInternals.setGhostEaten("blinky");
  });

  // Sample emergeProgress across the next ~30 update ticks. Any read
  // below 1 would mean the revive path re-armed the envelope — a
  // regression of the #224 scope rule.
  const samples = await page.evaluate(async () => {
    const out: Array<{ tick: number; emergeProgress: number; mode: string }> = [];
    const start = window.__pac!.tick;
    while (window.__pac!.tick - start < 30) {
      const s = window.__pac!;
      const b = s.ghosts.find((g) => g.name === "blinky")!;
      out.push({ tick: s.tick, emergeProgress: b.emergeProgress, mode: b.mode });
      await new Promise((r) => setTimeout(r, 20));
    }
    return out;
  });

  // At least one sample must show Blinky in 'eaten' mode (otherwise the
  // hook didn't actually take and we're testing nothing). The eyes ride
  // home at 0.20/tick and the revive tile is 3 rows away — the eaten
  // window is comfortably wider than our 30-tick sampling band.
  expect(samples.some((s) => s.mode === "eaten")).toBe(true);
  for (const s of samples) {
    expect(s.emergeProgress).toBe(1);
  }
});
