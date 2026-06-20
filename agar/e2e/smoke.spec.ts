import { test, expect } from "@playwright/test";

// agar slice 1/4 smoke — the slot exists, not "the game works".
//
// Asserts only what the scaffold ships:
//   (a) /agar/ returns 200.
//   (b) A <canvas> element is in the DOM after load.
//   (c) No console.error events fire in the first 1000ms after load.
//
// Real gameplay verification arrives in slice 4 (two-client e2e against
// the authoritative DO tick). Keep this test mechanical.
test("agar slot loads with canvas and no console errors", async ({ page }) => {
  // (c) Collect console.error events from the moment the page context
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

  // (a) Navigation returns 200. We use `domcontentloaded` so the response
  // status is checked before main.ts has finished its single frame draw.
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response, "navigation response").not.toBeNull();
  expect(response!.status(), "GET /agar/ status").toBe(200);

  // (b) Canvas is in the DOM. Use the same selector main.ts queries so a
  // rename to #game can't pass the smoke while breaking the real mount.
  await expect(page.locator("canvas#game")).toHaveCount(1);

  // (c) Wait 1000ms then assert no errors accumulated.
  await page.waitForTimeout(1000);
  expect(consoleErrors, "console.error events in first 1000ms").toEqual([]);
});
