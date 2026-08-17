import { expect, test } from "@playwright/test";

const phoneViewport = { width: 390, height: 844 };

async function visibleDialogueText(page: import("@playwright/test").Page): Promise<string> {
  const snapshot = await page.locator("body").innerText();
  return snapshot.replace(/\s+/g, " ").trim();
}

async function tapVisibleOption(page: import("@playwright/test").Page, name: RegExp): Promise<void> {
  const option = page.getByRole("button", { name }).first();
  await expect(option).toBeVisible();
  await option.tap();
}

test.describe("M-CONTINUE played acceptance", () => {
  test.use({ viewport: phoneViewport, hasTouch: true, isMobile: true });

  test("a phone player can tap past Io's return recognition into the tone fork and next job", async ({ page }) => {
    await page.goto("/aftersign/");

    await tapVisibleOption(page, /tap.*packet/i);
    await tapVisibleOption(page, /deliver packet/i);
    await tapVisibleOption(page, /return.*io|return/i);

    await expect.poll(() => visibleDialogueText(page)).toMatch(/remember|sealed|packet/i);

    // M-CONTINUE acceptance must be played, not driven: these are visible
    // player actions. window.__game is only read below as the assertion surface.
    await tapVisibleOption(page, /tone|answer|steady|warm|wary/i);
    await expect.poll(() => visibleDialogueText(page)).toMatch(/tone|steady|warm|wary|return/i);

    await tapVisibleOption(page, /next.*job|job|work/i);
    await expect.poll(() => visibleDialogueText(page)).toMatch(/next job|another job|work|packet/i);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const maybeGame = (window as typeof window & { __game?: { state?: { story?: { currentBeat?: unknown } } } }).__game;
          return maybeGame?.state?.story?.currentBeat ?? null;
        }),
      )
      .toBe("io-next-job");
  });
});
