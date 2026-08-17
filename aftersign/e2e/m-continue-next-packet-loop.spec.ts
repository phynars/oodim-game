import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;
const COLD_START_MS = 20_000;

test.describe("AFTERSIGN M-CONTINUE next-packet loop", () => {
  test("io-next-job lets the player start the next packet instead of re-delivering the old one", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `m-continue-next-packet-loop-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

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
    await waitForBeat("io-return-recognition");

    const toneButton = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
    await expect(toneButton, "return-tone button should stay visible after recognition").toBeVisible({
      timeout: WAIT_MS,
    });
    await toneButton.click();
    await waitForBeat("return-tone-choice");

    await tapChoice("ask-for-next-job");
    await waitForBeat("io-next-job");

    await tapChoice("deliver-packet");
    await waitForBeat("packet-choice");

    await expect(page.locator('button[data-choice-id="acknowledge-kiosk"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator('button[data-choice-id="deliver-packet"]')).toHaveText(/Deliver packet/i);
  });
});
