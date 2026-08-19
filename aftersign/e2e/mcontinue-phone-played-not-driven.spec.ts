import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function tapVisibleChoice(page: import("@playwright/test").Page, label: RegExp) {
  const choice = page.getByRole("button", { name: label }).first();
  await expect(choice).toBeVisible();
  const box = await choice.boundingBox();
  expect(box, `choice ${label} should have a rendered tap box`).not.toBeNull();
  expect(box!.width, `choice ${label} width should be thumb-sized`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `choice ${label} height should be thumb-sized`).toBeGreaterThanOrEqual(44);
  await choice.tap();
}

async function expectVisibleStory(page: import("@playwright/test").Page, text: RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

test.describe("M-CONTINUE phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("plays past Io return recognition by tapping rendered controls only", async ({ page }) => {
    await page.goto("/aftersign/");

    await expectVisibleStory(page, /Io|Night Post|blue seal|packet/i);

    await tapVisibleChoice(page, /keep|sealed|preserve/i);
    await expectVisibleStory(page, /sealed|unbroken|box|deliver/i);

    await tapVisibleChoice(page, /deliver|sign box|drop/i);
    await expectVisibleStory(page, /came back|return|Io/i);

    await tapVisibleChoice(page, /return|Io|back/i);
    await expectVisibleStory(page, /You came back|blue seal|unbroken/i);

    await tapVisibleChoice(page, /kind|evasive|blunt|answer/i);
    await expectVisibleStory(page, /next job|job|route|packet/i);

    const snapshot = await page.evaluate(() => window.__game?.getSnapshot?.());
    expect(snapshot?.scene?.beat).not.toBe("io-return-recognition");
  });
});
