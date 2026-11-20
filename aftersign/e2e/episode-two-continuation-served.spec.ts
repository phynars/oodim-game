import { expect, test, type Page } from "@playwright/test";

import { performPacketGesture } from "./helpers/packetGesture";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const TIMEOUT = 90_000;

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const button = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(button).toBeVisible({ timeout: TIMEOUT });
  await button.click();
}

async function runToEnding(page: Page): Promise<void> {
  await expect(page.locator("#packetButton")).toBeVisible({ timeout: TIMEOUT });
  await performPacketGesture(page, "sealed");
  await tapChoice(page, "deliver-packet");
  await expect(page.locator('button[data-return-reason="kind"]')).toBeVisible({ timeout: TIMEOUT });
  await page.locator('button[data-return-reason="kind"]').click();
  await tapChoice(page, "ask-for-next-job");
  await tapChoice(page, "accept-second-packet");
  const vigil = page.locator("#lightVigilButton");
  await expect(vigil).toBeVisible({ timeout: TIMEOUT });
  await vigil.click();
  await tapChoice(page, "carry-name-to-bell-archive");
  const nameChoice = page.locator("button[data-maud-name-choice]").first();
  await expect(nameChoice).toBeVisible({ timeout: TIMEOUT });
  await nameChoice.click();
  await expect(page.locator("#episodeOneEnding [data-ending-id]")).toBeVisible({ timeout: TIMEOUT });
  await page.locator('button[data-choice-id="open-unlit-door"]').click();
  await tapChoice(page, "keep-official-record");
  await expect(page.locator("#beginEpisodeTwo")).toBeVisible({ timeout: TIMEOUT });
}

test.describe("Episode 2 continuation — served phone flow", () => {
  test("shows a tap-reachable Begin Episode 2 control on the phone end screen", async ({ page }) => {
    test.setTimeout(TIMEOUT);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`/aftersign/?slot=episode-two-control-${Date.now()}`, { waitUntil: "load" });
    await runToEnding(page);
    await expect(page.locator("#beginEpisodeTwo")).toBeVisible();
    await expect(page.locator("#beginEpisodeTwo")).toHaveText("Begin Episode 2");
  });

  test("enters the Night Post after tapping Begin Episode 2", async ({ page }) => {
    test.setTimeout(TIMEOUT);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`/aftersign/?slot=episode-two-enter-${Date.now()}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").click();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible();
    await expect(page.locator("#episodeOneEnding")).toContainText("Night Post");
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
    await expect(page.locator("#episodeOneEnding [data-ending-id]")).toHaveCount(0);
  });

  test("names only the visibly selected Unlit Door choice at the Night Post", async ({ page }) => {
    test.setTimeout(TIMEOUT);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`/aftersign/?slot=episode-two-choice-${Date.now()}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").click();
    await expect(page.locator("#line")).toContainText("Night Post");
    const choice = await page.evaluate(() => (window as unknown as { __game?: { story?: { doorChoice?: string } } }).__game?.story?.doorChoice);
    expect(choice).toBeTruthy();
    await expect(page.locator("#line")).toContainText(choice as string);
  });

  test("restores the Night Post continuation after reload", async ({ page }) => {
    test.setTimeout(TIMEOUT);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`/aftersign/?slot=episode-two-reload-${Date.now()}`, { waitUntil: "load" });
    await runToEnding(page);
    await page.locator("#beginEpisodeTwo").click();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible();
    await page.reload({ waitUntil: "load" });
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: TIMEOUT });
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
  });
});
