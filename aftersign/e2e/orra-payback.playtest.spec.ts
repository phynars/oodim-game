import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 } as const;
const WAIT = 12_000;

async function beat(page: Page, id: string) {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function tapChoice(page: Page, id: string) {
  const button = page.locator(`button[data-choice-id="${id}"]:not([disabled])`).first();
  await expect(button).toBeVisible({ timeout: WAIT });
  await button.tap();
}

async function reachRedTagReturn(page: Page, openRedTag: boolean) {
  await beat(page, "packet-offered");
  await page.locator("#job-offer-job-safe-delivery").tap();
  await page.locator("#packetButton").tap();
  await beat(page, "packet-choice");
  await page.locator('#routeRiskChoice button[data-aftersign-tap-choice="take-the-long-way"]').tap();
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await beat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]').tap();
  await beat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await beat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await beat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await beat(page, "packet-choice");
  if (openRedTag) {
    // A deliberate hold is the served packet's open gesture; no game hook.
    const packet = page.locator("#packetButton");
    await packet.dispatchEvent("pointerdown", { pointerId: 7, clientX: 100, clientY: 100 });
    // allowed: the open gesture IS a wall-clock dwell — the packet-intent
    // threshold is a real-time hold the player's finger performs. No
    // state probe can replace the duration itself; shortening it below
    // the authored threshold would miss the "opened" outcome.
    await page.waitForTimeout(520);
    await packet.dispatchEvent("pointerup", { pointerId: 7, clientX: 100, clientY: 100 });
  }
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await beat(page, "io-return-recognition");
}

test.describe("Saint Orra payback", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("red-tag outcome changes the visible enabled route and its tap reaches an ending", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/aftersign/?slot=orra-payback-sealed-${Date.now()}`, { waitUntil: "load" });
    await reachRedTagReturn(page, false);

    const intact = page.locator('button[data-orra-payback-action="carry-name-to-bell-archive"]');
    await expect(intact).toBeVisible();
    await expect(intact).toBeEnabled();
    await intact.tap();
    await beat(page, "ending-bell-archive");
    await page.reload({ waitUntil: "load" });
    await expect(page.locator('[data-beat-id="ending-bell-archive"]')).toBeVisible({ timeout: WAIT });

    await page.goto(`/aftersign/?slot=orra-payback-opened-${Date.now()}`, { waitUntil: "load" });
    await reachRedTagReturn(page, true);
    const withheld = page.locator('button[data-orra-payback-action="leave-name-with-orra"]');
    await expect(withheld).toBeVisible();
    await expect(withheld).toBeEnabled();
    await expect(page.locator('[data-orra-payback-action="carry-name-to-bell-archive"]')).toHaveCount(0);
    await withheld.tap();
    await beat(page, "ending-orra-keeps-name");
  });
});
