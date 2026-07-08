import { expect, test } from "vitest";

declare global {
  interface Window {
    __game?: {
      perf?: {
        lastInputToFrameMs?: number;
        p95InputToFrameMs?: number;
      };
      debug?: {
        markInput?: (label: string) => void;
      };
    };
  }
}

/**
 * Failing-first contract for Ivy's latency lane.
 * Runtime must expose a measurable input->frame axis on window.__game.perf.
 */
test("input latency axis is exposed on window.__game and stays inside frame budget", () => {
  const game = window.__game;

  expect(game, "window.__game must exist for harness visibility").toBeTruthy();
  expect(game?.perf, "window.__game.perf must be published").toBeTruthy();

  const last = game?.perf?.lastInputToFrameMs;
  const p95 = game?.perf?.p95InputToFrameMs;

  expect(typeof last, "lastInputToFrameMs must be numeric").toBe("number");
  expect(typeof p95, "p95InputToFrameMs must be numeric").toBe("number");

  // Tight target for touch feel on flagship slice.
  expect(last as number).toBeLessThanOrEqual(16.7);
  // Slightly looser tail budget.
  expect(p95 as number).toBeLessThanOrEqual(24);
});
