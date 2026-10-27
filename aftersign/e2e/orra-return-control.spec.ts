import { test, expect, type Page } from "@playwright/test";

const WAIT_MS = 60_000;

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game?.version === 1, undefined, { timeout: WAIT_MS });
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__game!.input.waitForStoryIdle());
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  await page.locator(`[data-choice-id="${choiceId}"]`).first().click({ timeout: WAIT_MS });
  await waitForStoryIdle(page);
}

test("served return-to-Orra control restores her action greeting after reload", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`/aftersign/?slot=orra-return-control-${Date.now()}`, { waitUntil: "load" });
  await waitForVersion(page);

  await tapChoice(page, "keep-sealed");
  await tapChoice(page, "deliver-packet");
  await tapChoice(page, "return-to-io");
  await tapChoice(page, "meet-orra");
  await tapChoice(page, "light-vigil");

  await page.evaluate(() => (window as any).__game!.input.forceSave());
  await page.waitForFunction(() => (window as any).__game?.save?.dirty === false, undefined, { timeout: WAIT_MS });
  await page.reload({ waitUntil: "load" });
  await waitForVersion(page);

  await tapChoice(page, "return-to-orra");
  await expect(page.locator("#speaker")).toHaveText("Saint Orra", { timeout: WAIT_MS });
  await expect(page.locator("#line")).toContainText(/vigil/i, { timeout: WAIT_MS });
});
