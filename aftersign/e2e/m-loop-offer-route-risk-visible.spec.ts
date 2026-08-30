import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 10_000;
const firstRoute = "Take the lit stair. Do not stop under the bell rope.";
const firstRisk = "Low risk. Long route. Io can see most of it from the kiosk.";
const trustedRoute = "Cross behind the shuttered pharmacy before the bells count twice.";
const trustedRisk = "Short route. Unlit. Better pay because Io trusts your hands.";

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test("renders divergent route and risk copy after a player-tapped loop", async ({ page }) => {
  const slot = `offer-route-risk-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await expect(page.getByText(firstRoute, { exact: false })).toBeVisible();
  await expect(page.getByText(firstRisk, { exact: false })).toBeVisible();

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]').click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");

  await waitForBeat(page, "packet-offered");
  await expect(page.getByText(trustedRoute, { exact: false })).toBeVisible();
  await expect(page.getByText(trustedRisk, { exact: false })).toBeVisible();
  await expect(page.getByText(firstRoute, { exact: false })).toHaveCount(0);
  await expect(page.getByText(firstRisk, { exact: false })).toHaveCount(0);
});
