import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choice: string): Promise<void> {
  const button = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`);
  await expect(button).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

async function reachRedTagHandoff(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN red-tag handoff", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player sees Saint Orra's promised delivery and its resolution", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=red-tag-handoff-${Date.now()}`, { waitUntil: "load" });
    await reachRedTagHandoff(page);

    await expect(page.locator("#packetButton")).toHaveAttribute("data-packet-job", "red-tag");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const delivery = page.locator('button[data-choice-id="deliver-packet"]:not([disabled])');
    await expect(delivery).toHaveText("Deliver red tag to Saint Orra");
    await delivery.tap();
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("body")).toContainText("red tag delivered to Saint Orra");
  });
});
