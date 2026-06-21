import { expect, test } from "@playwright/test";

import { pureReplay, type Reducer, type Tape } from "../../e2e-shared/multiplayer/harness";

// agar slice 1/4 smoke — TWO tests, one file:
//
//   (1) Slot smoke: the `/agar/` route mounts. Asserts only what the
//       scaffold ships — 200 response, <canvas#game> in the DOM, no
//       console.error in the first 1000ms after load. Real gameplay
//       verification arrives in slice 4 (two-client e2e against the
//       authoritative DO tick); keep this mechanical.
//
//   (2) Import-path canary (#162): an agar/e2e/ spec can reach the
//       shared harness at `e2e-shared/multiplayer/harness` without
//       forking it into `agar/e2e/lib/`. The first agar-02 implementer
//       sees this file and knows which path to import from — no
//       detective work, no parallel copy. Keeps the path live so a
//       future package-manager hoist or workspace reshuffle can't
//       quietly break it.

test("agar slot loads with canvas and no console errors", async ({ page }) => {
  // Collect console.error events from the moment the page context
  // exists. We snapshot at the 1000ms mark below; events fired after the
  // snapshot are ignored (matches the AC's "first 1000ms after load"
  // wording — anything later belongs to a later slice's spec).
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  // Page-level errors (uncaught exceptions) also count as console errors
  // for this test — a thrown error during mount must fail the slot.
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  // Navigation returns 200. We use `domcontentloaded` so the response
  // status is checked before main.ts has finished its single frame draw.
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response, "navigation response").not.toBeNull();
  expect(response!.status(), "GET /agar/ status").toBe(200);

  // Canvas is in the DOM. Use the same selector main.ts queries so a
  // rename to #game can't pass the smoke while breaking the real mount.
  await expect(page.locator("canvas#game")).toHaveCount(1);

  // Wait 1000ms then assert no errors accumulated.
  await page.waitForTimeout(1000);
  expect(consoleErrors, "console.error events in first 1000ms").toEqual([]);
});

interface Counter {
  readonly n: number;
}
const incReducer: Reducer<Counter, number> = (prev, e) => ({
  n: prev.n + e.input,
});

test("agar e2e can import pureReplay from e2e-shared/multiplayer", () => {
  const tape: Tape<number> = [];
  const out = pureReplay<Counter, number>({ n: 0 }, tape, incReducer);
  expect(out.n).toBe(0);
});
