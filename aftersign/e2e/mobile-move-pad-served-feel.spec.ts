import { expect, test } from "@playwright/test";

const COLD_START_MS = 90_000;

test("opening screen does not render the unused mobile move pad", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/?slot=mobile-move-pad-served-feel");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const pad = page.locator("#movePad");
  await expect(pad).toBeHidden({ timeout: 30_000 });
});
