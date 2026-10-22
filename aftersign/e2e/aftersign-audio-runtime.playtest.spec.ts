import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type AudioState = {
  unlocked?: boolean;
  ambientStarted?: boolean;
  ambientState?: string;
  lastCue?: string | null;
};

declare global {
  interface Window {
    __game?: { _runtime?: { audio?: AudioState } };
  }
}

test.describe("AFTERSIGN served audio", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("visible job interaction enables ambient audio and publishes feedback", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/aftersign/index.html?slot=audio-runtime-${Date.now()}`, {
      waitUntil: "load",
    });

    const offer = page.locator("button[data-offered-job-id]").first();
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });
    await offer.tap();

    await expect
      .poll(
        () => page.evaluate(() => window.__game?._runtime?.audio?.lastCue),
        { timeout: WAIT_MS },
      )
      .toBe("job-offer-selected");
    await expect
      .poll(
        () => page.evaluate(() => window.__game?._runtime?.audio?.ambientStarted),
        { timeout: WAIT_MS },
      )
      .toBe(true);
    await expect
      .poll(
        () => page.evaluate(() => window.__game?._runtime?.audio?.ambientState),
        { timeout: WAIT_MS },
      )
      .toBe("playing");
  });
});
