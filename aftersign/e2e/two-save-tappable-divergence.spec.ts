import { expect, test, type Page } from "@playwright/test";

// M-LOOP divergence — played on the served phone surface.
//
// This test never advances story through window.__game. Every transition is
// a tap on a visible control. `__game` is read only for scene readiness;
// story beats and job actions are asserted through the rendered DOM.

const WAIT_MS = 10_000;
// This scenario includes two SwiftShader scene boots and a full delivery.
// Keep the aggregate budget separate from each UI assertion/action deadline:
// a slow cold start must not consume the entire multi-phase scenario budget.
const SCENARIO_TIMEOUT_MS = 180_000;

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
  await control.tap({ timeout: WAIT_MS });
}

async function completeSafeDelivery(page: Page): Promise<void> {
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

async function offeredActionIds(page: Page): Promise<string[]> {
  return page.locator("button[data-aftersign-job-take]").evaluateAll((buttons) =>
    buttons.map((button) => button.id).sort(),
  );
}

test.describe("AFTERSIGN two-save tappable divergence", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a fresh and completed durable record render different tappable job actions deterministically", async ({ page }) => {
    test.setTimeout(SCENARIO_TIMEOUT_MS);
    const slot = `two-save-divergence-${Date.now()}`;
    const freshActions = await test.step("boot fresh slot and assert initial offer", async () => {
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);
      await waitForBeat(page, "packet-offered");

      const actions = await offeredActionIds(page);
      await expect(page.locator("#job-offer-job-safe-delivery")).toBeVisible();
      expect(actions).toEqual(["job-offer-job-safe-delivery"]);
      return actions;
    });

    // The player's taps create the completed durable record in this slot.
    const completedActions = await test.step("complete delivery through visible taps and assert divergent offers", async () => {
      await completeSafeDelivery(page);
      await waitForBeat(page, "packet-offered");
      const actions = await offeredActionIds(page);
      expect(actions).toEqual([
        "job-offer-job-night-transfer",
        "job-offer-job-signed-receipt",
      ]);
      expect(actions).not.toEqual(freshActions);
      return actions;
    });

    // Reload the same durable slot: the returned action set is stable and
    // still rendered as tappable served-page controls.
    await test.step("reload durable slot and assert stable offers", async () => {
      await page.reload({ waitUntil: "load" });
      await waitForReady(page);
      await waitForBeat(page, "packet-offered");
      await expect(page.locator("#job-offer-job-night-transfer")).toBeVisible();
      await expect(page.locator("#job-offer-job-signed-receipt")).toBeVisible();
      expect(await offeredActionIds(page)).toEqual(completedActions);
    });
  });
});
