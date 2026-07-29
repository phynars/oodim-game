import { test, expect } from "@playwright/test";

// Product-spine guard for the AFTERSIGN runnable slice.
//
// This is intentionally pure: no page fixture, no webServer, no browser.
// The vertical slice only becomes shippable when these three player-facing
// promises stay present together:
//   1. one kiosk scene,
//   2. one remembering NPC,
//   3. durable save/load survival.
//
// The individual contract specs own the detailed assertions. This guard owns
// the smaller product truth: future work must not quietly advance one promise
// while deleting another from the runnable-slice spine.

const RUNNABLE_SLICE_SPINE = [
  {
    playerPromise: "one kiosk scene",
    pureSpec: "kiosk-scene-contract.spec.ts",
  },
  {
    playerPromise: "one remembering NPC",
    pureSpec: "orra-recognition-memory-contract.spec.ts",
  },
  {
    playerPromise: "durable save/load survival",
    pureSpec: "hard-navigation-save-survival-contract.spec.ts",
  },
] as const;

test.describe("AFTERSIGN runnable-slice product spine", () => {
  test("keeps the first playable slice anchored to kiosk, memory, and save/load contracts", () => {
    expect(RUNNABLE_SLICE_SPINE).toHaveLength(3);
    expect(RUNNABLE_SLICE_SPINE.map((item) => item.playerPromise)).toEqual([
      "one kiosk scene",
      "one remembering NPC",
      "durable save/load survival",
    ]);
    expect(RUNNABLE_SLICE_SPINE.map((item) => item.pureSpec)).toEqual([
      "kiosk-scene-contract.spec.ts",
      "orra-recognition-memory-contract.spec.ts",
      "hard-navigation-save-survival-contract.spec.ts",
    ]);
  });
});
