import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

async function visibleOfferIds(page: Page): Promise<string[]> {
  return page.locator('[id^="job-offer-"]').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node instanceof HTMLElement ? node : null;
        return Boolean(element && element.offsetParent !== null);
      })
      .map((node) => node.id)
      .sort(),
  );
}

test.describe("M-LOOP-E1 two-round phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("boots, completes round one, returns, and sees round two offer a different visible action set", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=m-loop-e1-two-round-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    await expect(page.getByText(/Offered jobs/i)).toBeVisible({ timeout: WAIT_MS });
    const firstRoundOfferIds = await visibleOfferIds(page);
    expect(firstRoundOfferIds).toEqual(["job-offer-job-safe-delivery"]);
    await expect(page.locator("#job-offer-job-safe-delivery")).toHaveText(
      "Safe delivery · low risk",
    );
    await page.locator("#job-offer-job-safe-delivery").tap();

    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job offers should clear while the player is inside the delivery beat",
    ).toHaveCount(0, { timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/I remember you.*blue seal.*unbroken/i)).toBeVisible({
      timeout: WAIT_MS,
    });
    await tapReturnReason(page, "blunt");

    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "packet-offered");
    const secondRoundOfferIds = await visibleOfferIds(page);
    expect(secondRoundOfferIds).toEqual(
      ["job-offer-job-night-transfer", "job-offer-job-signed-receipt"].sort(),
    );
    expect(secondRoundOfferIds).not.toEqual(firstRoundOfferIds);

    await expect(page.locator("#job-offer-job-night-transfer")).toHaveText(
      "Night transfer · medium risk",
    );
    await expect(page.locator("#job-offer-job-signed-receipt")).toHaveText(
      "Signed receipt · low risk",
    );
    await expect(page.locator("#job-offer-job-safe-delivery")).toHaveCount(0);
  });
});
