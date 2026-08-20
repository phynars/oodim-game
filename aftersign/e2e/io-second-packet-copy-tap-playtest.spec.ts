import { expect, test, type Page } from "@playwright/test";

import { selectIoSecondPacketCopyForReturnReason, type IoReturnReason } from "../src/ioSecondPacketCopy";

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

const RETURN_REASONS: readonly IoReturnReason[] = ["kind", "evasive", "blunt"];

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function tapReturnReason(page: Page, reason: IoReturnReason): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `recognition beat should expose the "${reason}" tone button`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function playToToneFork(page: Page, slot: string): Promise<void> {
  await page.goto(`?slot=${slot}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");

  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");

  // Auto-advance to recognition (~1180ms setTimeout in deliverPacket()).
  await waitForBeat(page, "io-return-recognition");
}

test.describe("Io second-packet copy is visible after the next-job handoff (#1322)", () => {
  for (const returnReason of RETURN_REASONS) {
    test(`tapping through the ${returnReason} return renders Io's pinned second-packet offer`, async ({ page }) => {
      test.setTimeout(SPEC_TIMEOUT_MS);

      const slot = `io-second-packet-${returnReason}-${Date.now()}`;
      const copy = selectIoSecondPacketCopyForReturnReason({ returnReason });
      const expectedLine = copy.lines.join(" ");

      await playToToneFork(page, slot);
      await tapReturnReason(page, returnReason);
      await waitForBeat(page, "return-tone-choice");

      await tapChoice(page, "ask-for-next-job");
      await waitForBeat(page, "io-next-job");

      const lineNode = page.locator("#line");
      await expect(lineNode).toContainText(expectedLine, { timeout: WAIT_MS });

      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (window as unknown as {
                  __game?: { npcs?: { io?: { lastLine?: string | null } } };
                }).__game?.npcs?.io?.lastLine ?? null,
            ),
          { timeout: WAIT_MS },
        )
        .toContain(expectedLine);

      for (const choice of copy.choices) {
        const choiceButton = page
          .locator(`button[data-choice-id="${choice.id}"]:not([disabled])`)
          .first();
        await expect(choiceButton).toBeVisible({ timeout: WAIT_MS });
        await expect(choiceButton).toHaveText(choice.label, { timeout: WAIT_MS });
      }
    });
  }
});
