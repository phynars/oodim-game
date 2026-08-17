import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;
const COLD_START_MS = 20_000;

test.describe("AFTERSIGN M-CONTINUE visible next-job playtest", () => {
  test("a phone player reaches Io's next job by tapping visible controls only", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `m-continue-visible-next-job-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    const lineNode = page.locator("#line");
    const waitForBeat = async (beatId: string) => {
      await expect(
        page.locator(`[data-beat-id="${beatId}"]`),
        `story line should visibly reach beat "${beatId}"`,
      ).toBeVisible({ timeout: WAIT_MS });
    };
    const tapChoice = async (choiceId: string) => {
      const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
      await expect(choice, `choice "${choiceId}" should be visible and tappable`).toBeVisible({ timeout: WAIT_MS });
      await choice.click();
    };

    await waitForBeat("packet-offered");
    await page.locator("#packetButton").click();
    await waitForBeat("packet-choice");

    await tapChoice("acknowledge-kiosk");
    await tapChoice("deliver-packet");
    await waitForBeat("packet-delivered");

    await waitForBeat("io-return-recognition");

    const toneButton = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
    await expect(toneButton, "return-tone button should stay visible after recognition").toBeVisible({
      timeout: WAIT_MS,
    });
    await toneButton.click();
    await waitForBeat("return-tone-choice");

    await tapChoice("ask-for-next-job");
    await waitForBeat("io-next-job");

    await expect(lineNode).toContainText("You kept the blue packet sealed", { timeout: WAIT_MS });
    await expect(lineNode).toContainText("Take the red tag to Saint Orra", { timeout: WAIT_MS });
  });
});
