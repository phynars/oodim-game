import { expect, test, type Page } from "@playwright/test";

// Episode 2 continuation: after the Unlit Door choice the Act II end card
// offers "Begin Episode 2", which enters the Night Post and survives reload.
// Taps only at 390×844; the route to the end card mirrors
// durable-act-ii-ending.spec.ts (job offer → sealed packet → Orra payback
// via button[data-orra-payback-action] → Maud name → Unlit Door).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const TEST_TIMEOUT = 120_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  await tapVisible(page, `button[data-choice-id="${choiceId}"]:not([disabled])`);
}

async function runToEnding(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
  await tapVisible(page, 'button[data-maud-name-choice="remembered-name"]');
  await expect(page.locator('[data-ending-id="maud-bell-archive-lit"]')).toBeVisible({ timeout: WAIT_MS });
  await tapChoice(page, "open-unlit-door");
  await tapChoice(page, "keep-official-record");
  await expect(page.locator("#beginEpisodeTwo")).toBeVisible({ timeout: WAIT_MS });
}

const slotFor = (tag: string) =>
  `ep2-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test.describe("Episode 2 continuation — served phone flow", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("shows a tap-reachable Begin Episode 2 control on the phone end screen", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto(`/aftersign/?slot=${slotFor("control")}`, { waitUntil: "load" });
    await runToEnding(page);
    await expect(page.locator("#beginEpisodeTwo")).toHaveText("Begin Episode 2");
    const begin = page.locator("#beginEpisodeTwo");
    const box = await begin.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // Actionability + hit-test: no overlay intercepts the tap.
    await begin.tap({ trial: true });
  });

  test("enters the Night Post after tapping Begin Episode 2", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto(`/aftersign/?slot=${slotFor("enter")}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator("#episodeOneEnding")).toContainText("Night Post");
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
    await expect(page.locator("#episodeOneEnding [data-ending-id]")).toHaveCount(0);
  });

  test("names only the visibly selected Unlit Door choice at the Night Post", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto(`/aftersign/?slot=${slotFor("choice")}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").tap();
    const nightPost = page.locator('#episodeOneEnding[data-continuation="night-post"]');
    await expect(nightPost).toBeVisible({ timeout: WAIT_MS });
    await expect(nightPost).toContainText("Keep the official record");
    await expect(nightPost).not.toContainText("Protect the private lie");
    await expect(nightPost).not.toContainText("Hang a new sign");
  });

  test("restores the Night Post continuation after reload", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto(`/aftersign/?slot=${slotFor("reload")}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await page.reload({ waitUntil: "load" });
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator("#episodeOneEnding")).toContainText("Keep the official record");
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
  });

  test("Start fresh from the Night Post leaves it and stays left after reload", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto(`/aftersign/?slot=${slotFor("reset")}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await tapVisible(page, "#resetButton");
    await expect(page.locator("#episodeOneEnding[data-continuation]")).toHaveCount(0, { timeout: WAIT_MS });
    await expect(page.locator("#episodeOneEnding")).not.toContainText("Night Post");
    await waitForBeat(page, "packet-offered");
    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "packet-offered");
    await expect(page.locator("#episodeOneEnding[data-continuation]")).toHaveCount(0);
    await expect(page.locator("#episodeOneEnding")).not.toContainText("Night Post");
  });
});
