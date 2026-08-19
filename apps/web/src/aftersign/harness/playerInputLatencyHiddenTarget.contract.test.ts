import { describe, expect, it } from "vitest";

// The active aftersign vitest lane is pinned to `windowGameHarnessBoot.test.ts`.
// Keep this placeholder skipped so a future widened glob does not treat the
// file as an empty suite; the runnable guard lives in the pinned lane.
describe.skip("Aftersign player-shaped latency probe target guard", () => {
  it("runs from windowGameHarnessBoot.test.ts", () => {
    expect(true).toBe(true);
  });
});
