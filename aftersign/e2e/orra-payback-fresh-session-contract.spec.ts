import { expect, test, type Page } from "@playwright/test";

// #2264 merge gate: after Orra's red-tag payback is committed, the same slot
// must restore the committed route in a browser context with no client storage.
// The first context performs the played write; the second proves DO/D1 restore.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

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

async function reachSealedRedTagReturn(page: Page): Promise<void> {
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  await page
    .locator('#offeredJobs button[data-offered-job-id="job-safe-delivery"]')
    .tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  await page
    .locator('#offeredJobs button[data-offered-job-id="job-night-transfer"]')
    .tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { delivery?: { id?: string } } })
        .__game?.delivery?.id === "red-tag",
    undefined,
    { timeout: WAIT_MS },
  );
}

test.describe("Saint Orra payback fresh-session durability (#2264)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a committed sealed red-tag action survives the DO write, D1 reload, and fresh browser context", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const slot = `orra-payback-fresh-session-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await reachSealedRedTagReturn(page);

    const carryName = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(carryName).toBeVisible({ timeout: WAIT_MS });
    await carryName.tap({ timeout: WAIT_MS });
    await expect(carryName).toHaveAttribute(
      "data-orra-payback-committed",
      "carry-name-to-bell-archive",
      { timeout: WAIT_MS },
    );

    const returningContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const returningPage = await returningContext.newPage();
    try {
      await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(returningPage);
      const restored = returningPage.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]',
      );
      await expect(restored).toBeVisible({ timeout: WAIT_MS });
      await expect(restored).toHaveAttribute(
        "data-orra-payback-committed",
        "carry-name-to-bell-archive",
        { timeout: WAIT_MS },
      );
      await expect(restored).toBeDisabled();
    } finally {
      await returningContext.close();
    }
  });
});
