import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = { scene?: { beat?: string; ready?: boolean } };

declare global {
  interface Window {
    __game?: { getSnapshot?: () => Snapshot };
  }
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat),
    { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] },
  ).toBe(beat);
}

async function tapChoice(page: Page, choice: string): Promise<void> {
  const button = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`);
  await expect(button).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

async function reachLaterOfferAfterSealing(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await tapChoice(page, "ask-for-next-job");
  await tapChoice(page, "accept-second-packet");
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN stale seal and red-tag affordance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("does not repeat the blue-seal reminder after the seal decision", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/index.html?slot=stale-seal-${Date.now()}`, { waitUntil: "load" });
    await reachLaterOfferAfterSealing(page);
    await expect(page.locator("#line")).not.toContainText("Keep it sealed if you want the city to trust you");
  });

  test("tapping an interactive red-tag label at 390x844 produces its visible outcome", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/index.html?slot=red-tag-tap-${Date.now()}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    const redTag = page.locator('#packetButton[data-packet-job="red-tag"]');
    await expect(redTag).toBeVisible();
    await expect(redTag).toHaveText("Red tag — Saint Orra");
    await redTag.tap();
    await waitForBeat(page, "packet-choice");
    await expect(page.locator('button[data-choice-id="deliver-packet"]')).toHaveText("Deliver red tag to Saint Orra");
  });

  test("a non-interactive red-tag label does not expose control styling", async ({ page }) => {
    await page.goto(`/aftersign/index.html?slot=red-tag-style-${Date.now()}`, { waitUntil: "load" });
    await expect(page.locator("#packetButton")).toHaveCount(1);
    await expect(page.locator("[data-red-tag-label]")).toHaveCount(0);
  });
});
