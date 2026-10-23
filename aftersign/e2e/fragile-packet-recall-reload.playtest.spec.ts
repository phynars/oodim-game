import { expect, test, type Page } from "@playwright/test";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

test.describe("AFTERSIGN fragile-packet recall", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a player reloads and returns to Io's fragile-packet recall", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `fragile-packet-recall-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();

    const tray = page.locator("#routeRiskChoice");
    const longWay = tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])');
    await expect(longWay).toBeVisible({ timeout: WAIT_MS });
    await longWay.tap();
    const unlockAfter = await page.evaluate((lockMs) => Date.now() + lockMs, ROUTE_RISK_CHOICE_LOCK_MS);
    await page.waitForFunction((deadline) => Date.now() >= deadline, unlockAfter, { timeout: WAIT_MS });

    const fragileRoute = tray.locator(
      'button[data-aftersign-tap-choice="carry-a-fragile-packet"]:not([disabled])',
    );
    await expect(fragileRoute).toBeVisible({ timeout: WAIT_MS });
    await fragileRoute.tap();

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    const blunt = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
    await expect(blunt).toBeVisible({ timeout: WAIT_MS });
    await blunt.tap();
    await tapChoice(page, "ask-for-next-job");

    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await tapChoice(page, "deliver-packet");

    await expect(page.locator("#packetRecallLine")).toHaveAttribute(
      "data-aftersign-packet-recall",
      "fragile",
      { timeout: WAIT_MS },
    );
    await expect(page.locator("#packetRecallLine")).toContainText(
      "carefully you carried the fragile packet",
      { timeout: WAIT_MS },
    );
  });
});
