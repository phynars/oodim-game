import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — two durable saves, rendered tappable divergence.
//
// This is deliberately a served-page playtest: every transition below is a
// tap on a visible control. `window.__game` is used only for boot readiness.
// The first slot remains a first-run save; the second earns its completed
// memory record through the shipped packet loop, then reloads that same slot
// before its offer surface is inspected.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 60_000;
const COLD_START_MS = 180_000;

const FIRST_RUN_ROUTE_RISK_COPY =
  "Route: Take the lit stair. Do not stop under the bell rope. "
  + "Risk: Low risk. Long light. Io can see most of it from the kiosk.";
const TRUSTED_ROUTE_RISK_COPY =
  "Route: Cross behind the shuttered pharmacy before the bells count twice. "
  + "Risk: Short route. Unlit. Better pay because Io has one good fact about you.";

type OfferStamp = {
  id: string;
  action: string | null;
  fingerprint: string | null;
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
      fingerprint: node.getAttribute("data-offer-fingerprint"),
      routeRisk: node.getAttribute("data-route-risk"),
      text: node.textContent?.trim() ?? "",
    })),
  );
}

async function readRouteRiskCopy(page: Page): Promise<string> {
  const routeRiskCopy = page.locator(
    "#offeredJobs [data-aftersign-job-offer-route-risk]",
  );
  await expect(
    routeRiskCopy,
    "route/risk copy paragraph must render inside the served #offeredJobs tray",
  ).toBeVisible({ timeout: WAIT_MS });
  return (await routeRiskCopy.textContent())?.trim() ?? "";
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
      fingerprint: "job-safe-delivery#low",
      routeRisk: "low",
    });
    const firstRunRouteRiskCopy = await readRouteRiskCopy(page);
    expect(firstRunRouteRiskCopy).toBe(FIRST_RUN_ROUTE_RISK_COPY);
    await expect(page.getByText(FIRST_RUN_ROUTE_RISK_COPY, { exact: true })).toBeVisible({
      timeout: WAIT_MS,
    });

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
    // This is the mechanical M-LOOP proof: the actual controls exposed to a
    // returning player have a different stable action identity, not merely
    // different words in Io's dialogue.
    expect(completedOffers.map((offer) => offer.fingerprint)).toEqual([
      "job-night-transfer#medium",
      "job-signed-receipt#low",
    ]);
    expect(completedOffers.map((offer) => offer.fingerprint)).not.toEqual(
      firstRunOffers.map((offer) => offer.fingerprint),
    );

    const completedRouteRiskCopy = await readRouteRiskCopy(page);
    expect(completedRouteRiskCopy).toBe(TRUSTED_ROUTE_RISK_COPY);
    await expect(page.getByText(TRUSTED_ROUTE_RISK_COPY, { exact: true })).toBeVisible({
      timeout: WAIT_MS,
    });
    expect(completedRouteRiskCopy).not.toBe(firstRunRouteRiskCopy);
    await expect(page.getByText(FIRST_RUN_ROUTE_RISK_COPY, { exact: true })).toHaveCount(0);

    // The durable completed record restores to io-next-job. Re-entering the
    // offer surface is itself a visible player tap, then the reloaded controls
    // must retain the same action identities and copy.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-next-job");
    await tap(page, '[data-choice-id="deliver-packet"]');
    await waitForBeat(page, "packet-offered");
    await expect.poll(() => readOffers(page)).toEqual(completedOffers);
    expect(await readRouteRiskCopy(page)).toBe(completedRouteRiskCopy);
  });
});
