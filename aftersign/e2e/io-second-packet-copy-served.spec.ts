import { expect, test, type Page } from "@playwright/test";

import { selectIoSecondPacketCopyForReturnReason } from "../src/ioSecondPacketCopy.ts";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

type ReturnReason = "kind" | "evasive" | "blunt";

type FlagshipReadOnlySnapshot = {
  scene: { beat: string };
  player: { returnReason?: string | null; name?: string | null };
  npcs: {
    io: {
      lastLine?: string | null;
    };
  };
};

declare global {
  interface Window {
    // Read-only assertion surface. This spec plays the served page by
    // tapping visible controls only; window.__game is never used to
    // cause a player action.
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipReadOnlySnapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<FlagshipReadOnlySnapshot> {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function tap(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipReadOnlySnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

const toneCases: Array<{
  readonly reason: ReturnReason;
  readonly selector: string;
  readonly buttonLabel: string;
}> = [
  { reason: "kind", selector: "#acknowledgeRouteButton", buttonLabel: "Kind return" },
  { reason: "evasive", selector: "#skipRouteButton", buttonLabel: "Evasive return" },
  { reason: "blunt", selector: "#deliverButton", buttonLabel: "Blunt return" },
];

test.describe("AFTERSIGN served second-packet copy", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const tone of toneCases) {
    test(`a phone player can reach Io's second-packet offer after a ${tone.reason} return`, async ({ page }) => {
      const slot = `io-second-packet-${tone.reason}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);

      await expect(page.locator("#line")).toBeVisible();
      await expect(page.locator("#deliverButton")).toBeVisible();

      // Player path only: deliver the first packet, wait for Io's
      // recognition beat, choose a visible return tone, then ask for
      // the next job. No harness input calls.
      await tap(page, "#deliverButton");
      await waitForBeat(page, "io-return-recognition");

      await expect(page.locator(tone.selector)).toHaveText(tone.buttonLabel);
      await tap(page, tone.selector);
      const returnToneChoice = await waitForBeat(page, "return-tone-choice");
      expect(returnToneChoice.player.returnReason).toBe(tone.reason);

      await expect(page.locator("#deliverButton")).toHaveText("Ask for next job");
      await tap(page, "#deliverButton");
      const nextJob = await waitForBeat(page, "io-next-job");

      const expectedCopy = selectIoSecondPacketCopyForReturnReason({
        returnReason: tone.reason,
        playerName: nextJob.player.name,
      });
      const expectedSecondPacketLine = expectedCopy.lines.join(" ");

      await expect(page.locator("#speaker")).toHaveText(expectedCopy.speaker);
      await expect(page.locator("#line")).toContainText(expectedSecondPacketLine);
      await expect(page.locator("#acknowledgeRouteButton")).toHaveText(
        expectedCopy.choices[0].label,
      );
      await expect(page.locator("#skipRouteButton")).toHaveText(
        expectedCopy.choices[1].label,
      );
      await expect(page.locator("#deliverButton")).toHaveText("Deliver next packet");
      expect(nextJob.npcs.io.lastLine).toContain(expectedSecondPacketLine);
    });
  }
});
