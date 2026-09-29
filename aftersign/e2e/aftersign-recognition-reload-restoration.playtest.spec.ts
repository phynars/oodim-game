import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 30_000;

async function waitForBeat(page: import("@playwright/test").Page, beat: string) {
  await expect
    .poll(() => page.locator("#aftersign").getAttribute("data-story-beat"), {
      timeout: COLD_START_MS,
    })
    .toBe(beat);
}

async function tapChoice(page: import("@playwright/test").Page, choice: string) {
  const control = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`);
  await expect(control).toBeVisible({ timeout: COLD_START_MS });
  await control.tap();
}

test.describe("AFTERSIGN recognition reload restoration", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("restores Io recognition instead of restarting after a phone-player reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `recognition-reload-restoration-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await tapChoice(page, "take-job");
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    const returnToIo = page.locator("#deliverButton:not([disabled])");
    await expect(returnToIo).toBeVisible({ timeout: COLD_START_MS });
    await returnToIo.tap();
    await waitForBeat(page, "io-return-recognition");

    const recognitionLine = page.locator("#dialogue");
    await expect(recognitionLine).toBeVisible();
    const beforeReload = await recognitionLine.textContent();
    await expect(beforeReload?.trim()).not.toBe("");
    await expect(page.locator('button[data-return-reason]:not([disabled])')).toHaveCount(3);

    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#dialogue")).toHaveText(beforeReload ?? "");
    await expect(page.locator('button[data-return-reason]:not([disabled])')).toHaveCount(3);
  });
});
