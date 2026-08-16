import { expect, test } from "@playwright/test";

const phoneViewport = { width: 390, height: 844 };

const clickVisibleChoice = async (page: import("@playwright/test").Page, choiceId: string) => {
  const choice = page.locator(`[data-choice-id="${choiceId}"], [data-aftersign-choice="${choiceId}"]`).first();
  await expect(choice).toBeVisible();
  await choice.tap();
};

const expectVisibleBeat = async (page: import("@playwright/test").Page, beatId: string) => {
  await expect(page.locator(`[data-beat-id="${beatId}"], [data-aftersign-beat="${beatId}"]`).first()).toBeVisible();
};

test.describe("M-CONTINUE phone playtest", () => {
  test.use({ viewport: phoneViewport, hasTouch: true, isMobile: true });

  test("a player taps past io-return-recognition into return-tone and next-job beats", async ({ page }) => {
    await page.goto("/aftersign/");

    await expectVisibleBeat(page, "packet-choice");
    await clickVisibleChoice(page, "keep-sealed");

    await expectVisibleBeat(page, "packet-offered");
    await clickVisibleChoice(page, "deliver-packet");

    await expectVisibleBeat(page, "io-return-recognition");
    await clickVisibleChoice(page, "return-to-io");

    await expectVisibleBeat(page, "return-tone-choice");
    await clickVisibleChoice(page, "choose-return-tone");

    await expectVisibleBeat(page, "io-next-job");
    await clickVisibleChoice(page, "ask-for-next-job");

    await expect(page.locator("body")).toContainText(/next job|orra|packet/i);
  });
});
