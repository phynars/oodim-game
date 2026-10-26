import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type AudioState = {
  unlocked?: boolean;
  ambientStarted?: boolean;
  ambientState?: string;
  musicStarted?: boolean;
  musicMuted?: boolean;
  lastCue?: string | null;
};

declare global {
  interface Window {
    __game?: { _runtime?: { audio?: AudioState } };
  }
}

test.describe("AFTERSIGN served audio", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("visible job and music controls unlock, mute, and unmute synthesized music", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/aftersign/index.html?slot=audio-runtime-${Date.now()}`, { waitUntil: "load" });

    const offer = page.locator("button[data-offered-job-id]").first();
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    // Music control stays hidden until a gesture unlocks audio.
    await expect(page.locator("#musicButton")).toBeHidden();
    // Job-offer tap (not the kiosk sound button) must be enough to reveal it.
    await offer.tap();

    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.ambientStarted), { timeout: WAIT_MS }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.musicStarted), { timeout: WAIT_MS }).toBe(true);

    const music = page.getByRole("button", { name: "Mute music" });
    await expect(music).toBeVisible();
    await music.tap();
    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.musicMuted), { timeout: WAIT_MS }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.lastCue), { timeout: WAIT_MS }).toBe("music-muted");

    await page.getByRole("button", { name: "Unmute music" }).tap();
    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.musicMuted), { timeout: WAIT_MS }).toBe(false);
    await expect.poll(() => page.evaluate(() => window.__game?._runtime?.audio?.lastCue), { timeout: WAIT_MS }).toBe("music-unmuted");
  });
});
