import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function visibleButton(page: import("@playwright/test").Page, name: RegExp | string) {
  const button = page.getByRole("button", { name }).first();
  await expect(button).toBeVisible();
  return button;
}

async function tapVisibleButton(page: import("@playwright/test").Page, name: RegExp | string) {
  const button = await visibleButton(page, name);
  await button.tap();
}

test.describe("AFTERSIGN M-CONTINUE played acceptance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player taps past Io's return recognition into the tone fork and next job", async ({ page }) => {
    await page.goto("/aftersign");

    await expect(page.getByText(/Io Vale/i).first()).toBeVisible();

    await tapVisibleButton(page, /start|begin|enter|continue|wake/i);
    await tapVisibleButton(page, /take|accept|packet|continue|go/i);
    await tapVisibleButton(page, /listen|route|continue|go/i);
    await tapVisibleButton(page, /deliver|return|continue|go/i);

    await expect(page.getByText(/You came back/i).first()).toBeVisible();

    await tapVisibleButton(page, /continue|answer|plain|why/i);

    await expect(page.getByText(/why come back/i).first()).toBeVisible();

    await tapVisibleButton(page, /kind|evasive|blunt/i);

    await expect(page.getByText(/Careful|No one is nearby|Honesty is ugly/i).first()).toBeVisible();

    await tapVisibleButton(page, /Take the next mark|continue/i);

    await expect(page.getByText(/The city keeps two ledgers/i).first()).toBeVisible();

    await tapVisibleButton(page, /Accept the red tag|Take the next mark|continue/i);

    await expect(page.getByText(/Moth Pier lost a boat-name/i).first()).toBeVisible();
  });
});
