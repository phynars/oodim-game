import { expect, test, type Page } from "@playwright/test";

// #2260/#2264: a completed red-tag outcome must be recovered from the
// server-backed slot in a new browser context, not replayed from client
// storage retained by page.reload().
//
// GATED (test.fixme): the Orra payback UI — a single
// `button[data-orra-payback-action="carry-name-to-bell-archive"]` whose
// committed state is exposed via `data-orra-payback-committed` — is not yet
// rendered by aftersign/src. A grep of aftersign/src for
// `data-orra-payback` returns zero matches at this commit, so a live run
// of this spec would red the AFTERSIGN e2e job at the first visibility
// assertion. The sibling specs
// `orra-payback-durable-contract.spec.ts` and
// `orra-payback-fresh-session-contract.spec.ts` are `test.fixme`'d on the
// same missing surface; this spec mirrors that gate. Promote back to
// `test(...)` in the SAME PR that lands the payback button + server-backed
// restore.

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

async function reachRedTagRecognition(page: Page): Promise<void> {
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
  await page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .tap();
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
}

test.describe("AFTERSIGN Saint Orra durable red-tag route (#2264)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test.fixme("sealed red-tag payback reappears in a fresh browser context", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const slot = `saint-orra-durable-route-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await reachRedTagRecognition(page);

    const carryName = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(carryName).toBeVisible({ timeout: WAIT_MS });
    await expect(carryName).toBeEnabled();
    await carryName.tap({ timeout: WAIT_MS });
    await expect(carryName).toHaveAttribute(
      "data-orra-payback-committed",
      "carry-name-to-bell-archive",
      { timeout: WAIT_MS },
    );

    // No storageState is transferred. The same slot is the only link between
    // sessions, so this assertion fails if the client is the authority.
    const returningContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const returningPage = await returningContext.newPage();
    try {
      await returningPage.goto(`/aftersign/?slot=${slot}`, {
        waitUntil: "load",
      });
      await waitForReady(returningPage);
      const restoredCarryName = returningPage.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]',
      );
      await expect(restoredCarryName).toBeVisible({ timeout: WAIT_MS });
      await expect(restoredCarryName).toHaveAttribute(
        "data-orra-payback-committed",
        "carry-name-to-bell-archive",
        { timeout: WAIT_MS },
      );
      await expect(restoredCarryName).toBeDisabled();
    } finally {
      await returningContext.close();
    }
  });
});
