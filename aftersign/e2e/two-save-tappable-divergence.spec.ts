import { expect, test, type Page } from "@playwright/test";

// Read only the served DOM; game state is used solely as a readiness gate.
const WAIT_MS = 45_000;
type OfferReadout = {
  ids: string[];
  actionIds: string[];
  byId: Record<string, { actionId: string; routeRisk: string; text: string }>;
  routeRiskCopy: string;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(`${selector}:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap({ timeout: WAIT_MS });
}

async function readOfferedActions(page: Page): Promise<OfferReadout> {
  const offers = page.locator('[id^="job-offer-"]:visible');
  await expect(offers.first()).toBeVisible({ timeout: WAIT_MS });
  const byId: OfferReadout["byId"] = {};
  for (let index = 0; index < await offers.count(); index += 1) {
    const offer = offers.nth(index);
    await expect(offer).toBeEnabled();
    await expect(offer).toHaveAttribute("data-aftersign-job-take", "ready");
    await expect(offer).toHaveAttribute("data-aftersign-job-take-action", /.+/);
    await expect(offer).toHaveAttribute("data-route-risk", /^(low|medium|high)$/);
    const id = (await offer.getAttribute("id"))!;
    byId[id] = {
      actionId: (await offer.getAttribute("data-aftersign-job-take-action"))!,
      routeRisk: (await offer.getAttribute("data-route-risk"))!,
      text: (await offer.textContent())?.trim() ?? "",
    };
  }
  const copy = page.locator('[data-aftersign-job-offer-route-risk]:visible');
  await expect(copy).toBeVisible({ timeout: WAIT_MS });
  return {
    ids: Object.keys(byId).sort(),
    actionIds: Object.values(byId).map((offer) => offer.actionId).sort(),
    byId,
    routeRiskCopy: (await copy.textContent())?.trim() ?? "",
  };
}

async function completeSafeDelivery(page: Page): Promise<void> {
  await tap(page, "#job-offer-job-safe-delivery");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tap(page, 'button[data-return-reason="blunt"]');
  await waitForBeat(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tap(page, 'button[data-choice-id="deliver-packet"]');
}

test.describe("AFTERSIGN two-save tappable divergence (served page)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("fresh and completed durable records render divergent actions and copy deterministically", async ({ page }) => {
    test.setTimeout(180_000);
    const slot = `two-save-divergence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    const fresh = await readOfferedActions(page);
    expect(fresh.ids).toEqual(["job-offer-job-safe-delivery"]);
    expect(fresh.byId["job-offer-job-safe-delivery"].routeRisk).toBe("low");
    expect(fresh.routeRiskCopy).toContain("Take the lit stair. Do not stop under the bell rope.");
    expect(fresh.routeRiskCopy).toContain("Low risk. Long light. Io can see most of it from the kiosk.");

    await completeSafeDelivery(page);
    await waitForBeat(page, "packet-offered");
    const completed = await readOfferedActions(page);
    expect(completed.ids).toEqual(["job-offer-job-night-transfer", "job-offer-job-signed-receipt"]);
    expect(completed.ids).not.toEqual(fresh.ids);
    expect(completed.actionIds).not.toEqual(fresh.actionIds);
    expect(completed.byId["job-offer-job-night-transfer"].routeRisk).toBe("medium");
    expect(completed.byId["job-offer-job-signed-receipt"].routeRisk).toBe("low");
    expect(completed.routeRiskCopy).toContain("Cross behind the shuttered pharmacy before the bells count twice.");
    expect(completed.routeRiskCopy).toContain("Short route. Unlit. Better pay because Io has one good fact about you.");
    expect(completed.routeRiskCopy).not.toEqual(fresh.routeRiskCopy);

    // The durable stamp restores io-next-job, not packet-offered. Re-enter
    // offers via the same visible control used during the live session.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-next-job");
    await tap(page, 'button[data-choice-id="deliver-packet"]');
    await waitForBeat(page, "packet-offered");
    expect(await readOfferedActions(page)).toEqual(completed);
  });
});
