import { expect, test, type Page } from "@playwright/test";

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
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function expectFullyInsidePhone(page: Page, selector: string): Promise<void> {
  const rect = await page.locator(selector).evaluate((element) => {
    const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
    return { left, top, right, bottom, width, height };
  });
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
  expect(rect.bottom).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
}

test.describe("AFTERSIGN M-LOOP round-two entry", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played first round reaches a different job and starts the second route", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=mloop-round-two-entry-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    const firstRoundTray = page.locator("#offeredJobs");
    // Read via `getAttribute` (not `toHaveAttribute`) so the served-
    // divergence played-witness contract in
    // `apps/web/src/aftersign/aftersignMloopServedDivergencePlaytestContract.test.ts`
    // can see the branch label actually being READ off the rendered
    // tray on BOTH rounds, and so the two labels can be compared as
    // distinct durable-memory states below.
    const firstRoundDivergence = await firstRoundTray.getAttribute(
      "data-mloop-divergence-memory",
    );
    expect(firstRoundDivergence).toBe("fresh");
    const firstRoundJob = firstRoundTray.locator("button[data-offered-job-id]");
    await expect(firstRoundJob).toHaveCount(1);
    // Fresh durable memory must expose the deterministic safe action,
    // not merely any lone button. This makes the contrast with the
    // completed-memory round below visible at the action level.
    await expect(firstRoundJob).toHaveAttribute(
      "data-offered-job-id",
      "job-safe-delivery",
    );
    await firstRoundJob.tap();

    // Round-one walk: packet → acknowledge → deliver → recognition →
    // blunt tone → next-job → deliver. Inlined (not extracted into a
    // helper) because the served-divergence played-witness contract
    // in `apps/web/src/aftersign/aftersignMloopServedDivergencePlaytestContract.test.ts`
    // counts literal `waitForBeat(page, "io-return-recognition")`
    // occurrences in the SOURCE text and requires >= 2. Collapsing
    // this walk into a helper hides the beat behind a runtime call
    // and reds the contract (PR #2184 re-review, Soren Vask).
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const firstAcknowledgeRoute = page.locator('button[data-choice-id="acknowledge-kiosk"]');
    await expect(firstAcknowledgeRoute).toHaveText("I listened");
    await firstAcknowledgeRoute.tap();
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "packet-offered");
    const secondRoundTray = page.locator("#offeredJobs");
    const secondRoundDivergence = await secondRoundTray.getAttribute(
      "data-mloop-divergence-memory",
    );
    expect(secondRoundDivergence).toBe("completed");
    // The whole point of the served-divergence contract: two rounds
    // that completed under different durable-memory shapes must stamp
    // DIFFERENT labels on #offeredJobs. If a future refactor collapses
    // the branch, this fires before any UI assertion.
    expect(secondRoundDivergence).not.toBe(firstRoundDivergence);
    const secondRoundJobs = secondRoundTray.locator("button[data-offered-job-id]");
    await expect(secondRoundJobs).toHaveCount(2);
    // Rect check both offered rows and the route-risk badge: this is
    // the phone-fit assertion from #2182 — the SECOND row (signed
    // receipt) must sit inside 390×844 or a 390px player can't tap it.
    await expectFullyInsidePhone(page, '#offeredJobs [data-aftersign-job-offer-route-risk]');
    await expectFullyInsidePhone(
      page,
      'button[data-offered-job-id="job-night-transfer"]',
    );
    await expectFullyInsidePhone(
      page,
      'button[data-offered-job-id="job-signed-receipt"]',
    );

    // Walk the FIRST round-two route — `job-night-transfer` — all the
    // way through next-job. This is the walk the previous version of
    // this spec ran and is the regression guard the reviewer flagged
    // in #2184 round two: if a refactor breaks night-transfer's
    // delivered path, this fails here before we ever touch the
    // signed-receipt row. Walk inlined (see round-one comment above)
    // to keep the beat literal visible in source.
    const nightTransfer = secondRoundTray.locator(
      'button[data-offered-job-id="job-night-transfer"]',
    );
    await expect(nightTransfer).toHaveText("Night transfer · medium risk");
    await nightTransfer.tap();
    await expect(nightTransfer).toHaveAttribute("data-aftersign-job-take", "armed");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const nightTransferAcknowledgeRoute = page.locator(
      'button[data-choice-id="acknowledge-kiosk"]',
    );
    await expect(nightTransferAcknowledgeRoute).toHaveText("I listened");
    await nightTransferAcknowledgeRoute.tap();
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // Walk the SECOND round-two route — `job-signed-receipt` — which
    // is the row the stranger playtest in #2182 could not tap on
    // 390×844. Driving it the same way is the player-side proof the
    // phone fix works AND keeps the regression guard the reviewer
    // wanted on BOTH round-two routes rather than one. Walk inlined
    // (see round-one comment above) to keep the beat literal visible
    // in source.
    await waitForBeat(page, "packet-offered");
    const thirdRoundTray = page.locator("#offeredJobs");
    const signedReceipt = thirdRoundTray.locator(
      'button[data-offered-job-id="job-signed-receipt"]',
    );
    await expect(signedReceipt).toHaveText("Signed receipt · low risk");
    await signedReceipt.tap();
    await expect(signedReceipt).toHaveAttribute("data-aftersign-job-take", "armed");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const signedReceiptAcknowledgeRoute = page.locator(
      'button[data-choice-id="acknowledge-kiosk"]',
    );
    await expect(signedReceiptAcknowledgeRoute).toHaveText("I listened");
    await signedReceiptAcknowledgeRoute.tap();
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");
  });
});
