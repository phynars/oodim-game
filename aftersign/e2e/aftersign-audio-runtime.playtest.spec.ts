import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
// Boot can be slow on CI (WebGL + bundle); later steps are fast state flips.
const BOOT_WAIT_MS = 60_000;
const STEP_WAIT_MS = 10_000;

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

const audio = (page: Page) => page.evaluate(() => ({ ...(window.__game?._runtime?.audio ?? {}) }));

// Every tap carries its own timeout so a stalled actionability wait fails
// with a locator error naming the step instead of the opaque 90s test timeout.
const tapVisible = async (locator: Locator) => {
  await expect(locator).toBeVisible({ timeout: STEP_WAIT_MS });
  await expect(locator).toBeEnabled({ timeout: STEP_WAIT_MS });
  await locator.scrollIntoViewIfNeeded({ timeout: STEP_WAIT_MS });
  await locator.tap({ timeout: STEP_WAIT_MS });
};

test.describe("AFTERSIGN served audio", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("visible job and music controls unlock, mute, and unmute synthesized music", async ({ page }) => {
    test.setTimeout(150_000);

    await test.step("boot to a visible job offer", async () => {
      await page.goto(`/aftersign/index.html?slot=audio-runtime-${Date.now()}`, { waitUntil: "load" });
      await expect(page.locator("button[data-offered-job-id]").first()).toBeVisible({ timeout: BOOT_WAIT_MS });
      // Music control stays hidden until a gesture unlocks audio.
      await expect(page.locator("#musicButton")).toBeHidden();
    });

    await test.step("job-offer tap unlocks ambient + music", async () => {
      // Job-offer tap (not the kiosk sound button) must be enough to reveal it.
      await tapVisible(page.locator("button[data-offered-job-id]").first());
      await expect.poll(async () => (await audio(page)).ambientStarted, { timeout: STEP_WAIT_MS }).toBe(true);
      await expect.poll(async () => (await audio(page)).musicStarted, { timeout: STEP_WAIT_MS }).toBe(true);
    });

    await test.step("tap Mute music", async () => {
      await tapVisible(page.locator("#musicButton").and(page.getByRole("button", { name: "Mute music" })));
      await expect.poll(async () => (await audio(page)).musicMuted, { timeout: STEP_WAIT_MS }).toBe(true);
      await expect.poll(async () => (await audio(page)).lastCue, { timeout: STEP_WAIT_MS }).toBe("music-muted");
    });

    await test.step("tap Unmute music", async () => {
      await tapVisible(page.locator("#musicButton").and(page.getByRole("button", { name: "Unmute music" })));
      await expect.poll(async () => (await audio(page)).musicMuted, { timeout: STEP_WAIT_MS }).toBe(false);
      await expect.poll(async () => (await audio(page)).lastCue, { timeout: STEP_WAIT_MS }).toBe("music-unmuted");
    });
  });
});
