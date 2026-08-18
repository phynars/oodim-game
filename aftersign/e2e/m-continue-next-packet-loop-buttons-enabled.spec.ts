import { expect, test } from "@playwright/test";

const appUrl = "/aftersign/?slot=m-continue-next-packet-loop-buttons-enabled";

const expectVisibleButtonEnabled = async (page, text: string) => {
  const button = page.getByRole("button", { name: text });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  return button;
};

test.describe("M-CONTINUE next packet loop button affordance", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("a player can tap the next packet loop choices after Io hands off the next job", async ({ page }) => {
    await page.goto(appUrl);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const packetButton = page.getByRole("button", { name: /hold packet/i });
    await expect(packetButton).toBeVisible();
    await packetButton.tap();

    await (await expectVisibleButtonEnabled(page, "Acknowledge route")).tap();
    await (await expectVisibleButtonEnabled(page, "Deliver packet")).tap();

    await expect(page.locator("#line")).toHaveAttribute(
      "data-aftersign-beat",
      "io-return-recognition",
      { timeout: 5000 },
    );

    await (await expectVisibleButtonEnabled(page, "Blunt return")).tap();
    await expect(page.locator("#line")).toHaveAttribute(
      "data-aftersign-beat",
      "return-tone-choice",
      { timeout: 5000 },
    );

    await (await expectVisibleButtonEnabled(page, "Ask for next job")).tap();
    await expect(page.locator("#line")).toHaveAttribute(
      "data-aftersign-beat",
      "io-next-job",
      { timeout: 5000 },
    );

    await (await expectVisibleButtonEnabled(page, "Deliver next packet")).tap();
    await expect(page.locator("#line")).toHaveAttribute(
      "data-aftersign-beat",
      "packet-choice",
      { timeout: 5000 },
    );

    await (await expectVisibleButtonEnabled(page, "Acknowledge route")).tap();
    await (await expectVisibleButtonEnabled(page, "Skip acknowledgment")).tap();
    await expectVisibleButtonEnabled(page, "Deliver packet");
  });
});
