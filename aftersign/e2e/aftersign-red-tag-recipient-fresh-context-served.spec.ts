import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN's third NPC recognition must be restored from the durable slot,
// not storage retained by the browser context that delivered the red tag.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const RECIPIENT_LINE = "#aftersignRedTagRecipientLine";
const DISPOSITION_ATTR = "data-aftersign-red-tag-recipient";
const COUNT_ATTR = "data-aftersign-red-tag-recipient-count";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function reachNextJobFromBoot(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN third NPC — fresh-context red-tag recognition", () => {
  test("red-tag delivery is restored in a browser context with no copied storage", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(120_000);
    const slot = `red-tag-recipient-fresh-context-${Date.now()}`;
    const deliveryContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const deliveryPage = await deliveryContext.newPage();

    try {
      await deliveryPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(deliveryPage);
      await reachNextJobFromBoot(deliveryPage);
      await deliveryPage.locator("#packetButton").tap();
      await waitForBeat(deliveryPage, "packet-choice");
      await tapChoice(deliveryPage, "acknowledge-kiosk");
      await tapChoice(deliveryPage, "deliver-packet");
      await waitForBeat(deliveryPage, "io-return-recognition");
      await expect(deliveryPage.locator(RECIPIENT_LINE)).toHaveAttribute(
        DISPOSITION_ATTR,
        "recognizes-player",
      );
    } finally {
      await deliveryContext.close();
    }

    const restoredContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const restoredPage = await restoredContext.newPage();

    try {
      await restoredPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(restoredPage);
      await waitForBeat(restoredPage, "io-return-recognition");
      const recipientLine = restoredPage.locator(RECIPIENT_LINE);
      await expect(recipientLine).toBeVisible({ timeout: WAIT_MS });
      await expect(recipientLine).toHaveAttribute(
        DISPOSITION_ATTR,
        "recognizes-player",
      );
      await expect(recipientLine).toHaveAttribute(COUNT_ATTR, "1");
    } finally {
      await restoredContext.close();
    }
  });
});
