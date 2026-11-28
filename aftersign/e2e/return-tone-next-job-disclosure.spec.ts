import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => window.__game?.scene?.beat ?? null),
    { timeout: WAIT_MS },
  ).toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.tap();
}

async function playToNextJob(page: Page, tone: "kind" | "blunt"): Promise<string> {
  await page.goto(`/aftersign/?slot=return-tone-disclosure-${tone}-${Date.now()}`, {
    waitUntil: "load",
  });
  await waitForBeat(page, "packet-offered");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, tone === "kind" ? "#acknowledgeRouteButton" : "#skipRouteButton");
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-return-recognition");
  await tap(page, tone === "kind" ? "#acknowledgeRouteButton" : "#deliverButton");
  await waitForBeat(page, "return-tone-choice");
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-next-job");

  await expect(page.locator("#ioNextJobToneDisclosure")).toHaveText(
    `Your ${tone} return changes Io's wording, not the job offer.`,
  );
  return page.locator("#packetButton").innerText();
}

test.describe("AFTERSIGN return-tone next-job disclosure", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("kind and blunt returns disclose their wording-only difference and retain the same offer", async ({ page }) => {
    const kindOffer = await playToNextJob(page, "kind");
    const bluntOffer = await playToNextJob(page, "blunt");

    expect(kindOffer).toBe("Red tag — Saint Orra");
    expect(bluntOffer).toBe(kindOffer);
  });
});
