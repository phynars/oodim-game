import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function reachPacketChoice(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");
  await page.locator("#job-offer-job-safe-delivery").tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
}

async function returnToOffer(page: Page): Promise<void> {
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  const reason = page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .first();
  await expect(reason).toBeVisible({ timeout: WAIT_MS });
  await reason.tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

async function chooseRouteAndReturn(page: Page, action: string): Promise<string> {
  const route = page
    .locator(`#routeRiskChoice button[data-aftersign-tap-choice="${action}"]:not([disabled])`)
    .first();
  await expect(route).toBeVisible({ timeout: WAIT_MS });
  await route.tap();
  await expect(route).toBeHidden({ timeout: WAIT_MS });
  await returnToOffer(page);
  const recall = page.locator("#packetRecallLine");
  await expect(recall).toBeVisible({ timeout: WAIT_MS });
  return recall.innerText();
}

test.describe("AFTERSIGN safe-route trust recall", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("lit stair recall names the lit stair, never the safe route", async ({ page }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page, `safe-route-lit-${Date.now()}`);
    const line = await chooseRouteAndReturn(page, "take-the-long-way");

    expect(line).toBe(
      "Io remembers you brought the packet back sealed. She left the lamp burning: the lit stair you chose held. Keep the route lit for the next packet.",
    );
    expect(line).not.toMatch(/safe route/i);
    expect(line).not.toMatch(/worth trusting again/i);
  });

  test("shortcut recall never borrows the lit stair line", async ({ page }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page, `safe-route-shortcut-${Date.now()}`);
    await chooseRouteAndReturn(page, "take-the-long-way");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const line = await chooseRouteAndReturn(page, "take-the-shortcut");

    expect(line).not.toMatch(/lit stair/i);
    expect(line).not.toMatch(/safe route/i);
    expect(line).not.toMatch(/worth trusting again/i);
  });

  test("reaches both recall outcomes by visible pointer taps at 390×844", async ({ page }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page, `safe-route-visible-${Date.now()}`);
    const litLine = await chooseRouteAndReturn(page, "take-the-long-way");
    expect(litLine).toMatch(/lit stair/i);

    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const shortcutLine = await chooseRouteAndReturn(page, "take-the-shortcut");
    expect(shortcutLine).toMatch(/shortcut/i);
  });
});
