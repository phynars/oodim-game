import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — two durable saves, rendered tappable divergence.
//
// This is deliberately a served-page playtest: every transition below is a
// tap on a visible control. `window.__game` is used only for boot readiness.
// The first slot remains a first-run save; the second earns its completed
// memory record through the shipped packet loop, then reloads that same slot
// before its offer surface is inspected.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

type OfferStamp = {
  id: string;
  action: string | null;
  routeRisk: string | null;
  text: string;
};

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

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(`${selector}:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function readOffers(page: Page): Promise<OfferStamp[]> {
  const offers = page.locator("button[data-aftersign-job-take]");
  await expect(offers.first()).toBeVisible({ timeout: WAIT_MS });
  return offers.evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.id,
      action: node.getAttribute("data-aftersign-job-take-action"),
      routeRisk: node.getAttribute("data-route-risk"),
      text: node.textContent?.trim() ?? "",
    })),
  );
}

async function completeFirstRound(page: Page): Promise<void> {
  await tap(page, "#job-offer-job-safe-delivery");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, '[data-choice-id="acknowledge-kiosk"]');
  await tap(page, '[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tap(page, '[data-return-reason="blunt"]');
  await waitForBeat(page, "return-tone-choice");
  await tap(page, '[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tap(page, '[data-choice-id="deliver-packet"]');
}

test.describe("AFTERSIGN two durable saves — rendered tappable divergence", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("first-run and completed records render different offers, and each reload is deterministic", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const firstRunSlot = `two-save-first-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${firstRunSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    const firstRunOffers = await readOffers(page);
    expect(firstRunOffers.map((offer) => offer.id)).toEqual([
      "job-offer-job-safe-delivery",
    ]);
    expect(firstRunOffers[0]).toMatchObject({
      action: "mloop-safe-delivery-take",
      routeRisk: "low",
    });

    // Reboot the untouched first-run record: its rendered action is stable.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await expect.poll(() => readOffers(page)).toEqual(firstRunOffers);

    const completedSlot = `two-save-completed-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${completedSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await completeFirstRound(page);
    await waitForBeat(page, "packet-offered");
    const completedOffers = await readOffers(page);

    expect(completedOffers.map((offer) => offer.id)).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);
    expect(completedOffers.map((offer) => offer.routeRisk)).toEqual([
      "medium",
      "low",
    ]);
    expect(completedOffers.map((offer) => offer.action)).not.toEqual(
      firstRunOffers.map((offer) => offer.action),
    );

    // Reloading the completed durable record must preserve this same visible
    // tappable branch rather than merely keeping the hidden game state.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await expect.poll(() => readOffers(page)).toEqual(completedOffers);
  });
});
