import { test, expect } from "@playwright/test";

// agar-00 scaffold gate. Three structural assertions, no behavior:
//   1. The page loads at /agar/ (webServer is up, base path is right).
//   2. A <canvas id="game"> is present (the future render surface exists).
//   3. window.__game is present with `canonical: null` (the harness handle
//      the multiplayer slices will read; explicit-null is the scaffold
//      signal so agar-01's tests can assert non-null without ambiguity).
//
// NO waitForTimeout. The handle is set synchronously by src/main.ts on the
// module's first execution, so by the time `page.goto` resolves with the
// default `load` wait condition, the script has run. If that ever ceases
// to be true, the right fix is `page.waitForFunction(() => 'canonical' in
// (window as any).__game)` — never an arbitrary sleep.

test("agar scaffold: page loads, canvas present, harness handle ready", async ({
  page,
}) => {
  await page.goto("/");

  // Canvas exists and has the expected id — the contract surface for
  // every future agar slice.
  const canvas = page.locator("canvas#game");
  await expect(canvas).toBeVisible();

  // Harness handle: structural readiness signal. `canonical: null` is
  // the scaffold value; agar-01 will populate it with the echo'd state.
  const handle = await page.evaluate(() => {
    const g = (window as unknown as { __game?: { canonical: unknown } }).__game;
    return {
      present: g !== undefined && g !== null,
      hasCanonical: g !== undefined && g !== null && "canonical" in g,
      canonical: g?.canonical ?? "MISSING",
    };
  });

  expect(handle.present).toBe(true);
  expect(handle.hasCanonical).toBe(true);
  expect(handle.canonical).toBeNull();
});
