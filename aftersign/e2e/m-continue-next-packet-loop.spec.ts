import { expect, test, type Locator, type Page } from "@playwright/test";

type AftersignProbe = {
  input?: {
    waitForStoryIdle?: () => Promise<void>;
  };
};

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const game = (window as typeof window & { __game?: AftersignProbe }).__game;
    await game?.input?.waitForStoryIdle?.();
  });
}

async function visibleButton(page: Page, name: RegExp): Promise<Locator> {
  const candidate = page.getByRole("button", { name }).first();
  await expect(candidate, `visible button matching ${name}`).toBeVisible({ timeout: 10_000 });
  return candidate;
}

async function tapVisibleButton(page: Page, name: RegExp): Promise<void> {
  const button = await visibleButton(page, name);
  await button.tap();
  await waitForStoryIdle(page);
}

async function expectVisibleText(page: Page, text: RegExp): Promise<void> {
  await expect(page.getByText(text).first(), `visible text matching ${text}`).toBeVisible({ timeout: 10_000 });
}

test.describe("M-CONTINUE player playtest", () => {
  test.use({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  test("plays past Io recognition into the next packet loop using taps only", async ({ page }) => {
    await page.goto("/");
    await waitForStoryIdle(page);

    await expectVisibleText(page, /Io|Night Post|blue seal|packet/i);

    await tapVisibleButton(page, /tap packet|preserve|sealed|unbroken/i);
    await expectVisibleText(page, /story:\s*packet-choice/i);

    await tapVisibleButton(page, /acknowledge route|route/i);
    await expectVisibleText(page, /route listened/i);

    await tapVisibleButton(page, /deliver packet|deliver/i);

    await expectVisibleText(page, /came back|blue seal|unbroken|trust|use one of those facts|saving your life/i);
    await expectVisibleText(page, /story:\s*io-return-recognition/i);

    await tapVisibleButton(page, /blunt|work|job|back|because/i);
    await expectVisibleText(page, /next job|another packet|packet loop|job/i);

    await tapVisibleButton(page, /next job|take.*job|take.*packet|continue/i);

    await visibleButton(page, /tap packet|preserve|sealed|unbroken/i);
    await visibleButton(page, /open|break|seal/i);
    await visibleButton(page, /return|withhold|delay|deliver/i);
  });
});
