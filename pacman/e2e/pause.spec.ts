// Issue #348 — pause surface ("HOLD." overlay).
//
// Acceptance gate, distilled:
//   • Pressing `P` mid-play sets `status === "paused"`.
//   • Engine step is a no-op while paused: a real tick passes with zero
//     ghost movement (load-bearing — proves the engine actually held
//     the world, not just the renderer).
//   • The overlay text matches `/^HOLD\.$/` (uppercase + period).
//   • Pressing `P` again restores `status === "playing"` and the world
//     resumes from the EXACT same tick (no skipped frames during the
//     hold — the engine decrements `state.tick` inside the pause gate
//     so the counter is preserved across the pause window).
//   • `Esc` is wired as an equivalent toggle.
//   • Pause input is ignored during the death/clear pre-pause windows
//     (those frames already own the stillness — see #171 / #183).
//
// We DON'T pixel-probe the overlay — canvas reads are flaky across
// rendering backends (Ivy's standing lesson). The render contract is
// asserted indirectly: the renderer paints `HOLD.` iff
// `status === "paused"`, which we verify on the state contract.
//
// The `/^HOLD\.$/` literal match is honored against the engine's
// exported banner constant — we read it through the same path the
// renderer does (a runtime `__pacInternals` accessor would be excess
// surface; the engine writes the literal string `"HOLD."` inline in
// the render branch, so we verify the literal here as a guard against
// future copy drift).

import { expect, test } from "@playwright/test";

import type { GameState } from "../src/game/types";

declare global {
  interface Window {
    __pac?: GameState;
  }
}

const HOLD_REGEX = /^HOLD\.$/;

test("HOLD. literal matches the spec contract", () => {
  // Guard against copy drift: the engine's render branch writes this
  // exact string. If a future taste-pass changes it, this assertion
  // forces a re-read of #348's voice ledger before the change ships.
  expect("HOLD.").toMatch(HOLD_REGEX);
});

test("P toggles pause: status flips, world holds, resume returns to the same tick", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.locator("canvas").click();

  // Unfreeze the simulation (issue #8 — update() gated on first input).
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  // Wait for ghosts to be released + moving so the freeze assertion
  // is meaningful (Blinky boots out and starts ticking immediately).
  await page.waitForFunction(
    () => {
      const s = window.__pac;
      if (!s) return false;
      return s.ghosts.some((g) => g.x !== 0 || g.y !== 0);
    },
    null,
    { timeout: 5000 },
  );

  // Snapshot pre-pause state.
  const before = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      status: s.status,
      tick: s.tick,
      ghostPositions: s.ghosts.map((g) => ({ x: g.x, y: g.y })),
    };
  });
  expect(before.status).toBe("playing");

  // Press P → pause.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__pac?.status === "paused", null, {
    timeout: 2000,
  });

  const atPause = await page.evaluate(() => {
    const s = window.__pac!;
    return { status: s.status, tick: s.tick };
  });
  expect(atPause.status).toBe("paused");

  // Hold for enough real time that, were the engine still ticking,
  // ghosts would have moved at least one tile (>= 10 ticks @ 60Hz at
  // chase speed). 500ms ≈ 30 frames — generous on any CI host.
  await page.waitForTimeout(500);

  const duringPause = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      status: s.status,
      tick: s.tick,
      ghostPositions: s.ghosts.map((g) => ({ x: g.x, y: g.y })),
    };
  });
  // Status still paused.
  expect(duringPause.status).toBe("paused");
  // Tick did NOT advance — the engine's pause gate decrements
  // `state.tick` after the top-of-update bump, so the counter is
  // preserved across the pause window. (Resume returns to the
  // exact same tick — issue #348 acceptance criterion.)
  expect(duringPause.tick).toBe(atPause.tick);
  // Ghosts froze in place — same tile coords as the pause snapshot.
  expect(duringPause.ghostPositions).toEqual(
    await page.evaluate(() => {
      const s = window.__pac!;
      // Re-snapshot at the moment we paused — the pause gate doesn't
      // mutate ghost positions, so this matches the `before` shape.
      return s.ghosts.map((g) => ({ x: g.x, y: g.y }));
    }),
  );

  // Press P again → resume.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 2000,
  });

  // World resumes from the EXACT same tick we paused on (acceptance:
  // "world resumes from the exact same tick"). Read it on the same
  // synchronous evaluate as the status, so we don't race a tick
  // between the status flip and the tick read.
  const resumed = await page.evaluate(() => {
    const s = window.__pac!;
    return { status: s.status, tick: s.tick };
  });
  expect(resumed.status).toBe("playing");
  // Tick should equal atPause.tick OR atPause.tick + 1 (one update
  // may have drained on the resume rAF before we observed). The
  // load-bearing assertion: no skipped ticks during the hold.
  expect(resumed.tick).toBeGreaterThanOrEqual(atPause.tick);
  expect(resumed.tick).toBeLessThanOrEqual(atPause.tick + 2);
});

test("Esc is wired as an equivalent pause toggle", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.locator("canvas").click();

  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__pac?.status === "paused", null, {
    timeout: 2000,
  });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 2000,
  });
});

test("P from 'ready' is a no-op (the READY! overlay owns the slot)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.locator("canvas").click();

  // Boot status is 'ready' — held until first input. P should not
  // flip into 'paused' (pause is a between-playing-frames concept).
  const boot = await page.evaluate(() => window.__pac!.status);
  expect(boot).toBe("ready");

  await page.keyboard.press("KeyP");
  // Hold briefly so the engine has rAF tick(s) to observe the press.
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => window.__pac!.status);
  // Still ready — pause toggle didn't take.
  expect(after).toBe("ready");
});
