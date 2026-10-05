import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN served-page regressions for #2174 and #2181.
// A visible Return to Io tap must never become a Blunt return when the
// reused #deliverButton is restamped during the beat transition.

type ReturnReasonSnapshot = {
  scene?: { beat?: string };
  player?: { returnReason?: string | null };
  interaction?: {
    pendingReturnReason?: string | null;
    recognitionEnteredAt?: number | null;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => ReturnReasonSnapshot;
      input?: { waitForStoryIdle?: () => unknown | Promise<unknown> };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 20_000;
const SPEC_TIMEOUT_MS = 120_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__game?.input?.waitForStoryIdle?.();
  });
}

async function snapshot(page: Page): Promise<ReturnReasonSnapshot> {
  await waitForGame(page);
  await waitForStoryIdle(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function deliverFirstPacket(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
}

async function assertUntonedRecognitionAfterReturn(page: Page): Promise<void> {
  await waitForBeat(page, "io-return-recognition");
  const afterReturnToIo = await snapshot(page);
  expect(afterReturnToIo.player?.returnReason ?? null).toBeNull();
  await expect(
    page.locator('button[data-return-reason]:not([disabled])'),
  ).toHaveCount(3);
}

test.describe("AFTERSIGN Return to Io does not silently record a blunt tone", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("round one: tapping Return to Io leaves player.returnReason unset", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    await page.goto(`/aftersign/?slot=return-to-io-no-false-blunt-${Date.now()}`, {
      waitUntil: "load",
    });

    await deliverFirstPacket(page);
    await tapChoice(page, "return-to-io");
    await assertUntonedRecognitionAfterReturn(page);

    // Explicit tone taps must land on themselves — never silently blunt.
    // The round-one defense is both: (a) return-to-io leaves the slot empty,
    // and (b) a subsequent Evasive tap writes "evasive" and only "evasive".
    await tapChoice(page, "choose-return-tone");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "return-tone-evasive");
    const afterEvasive = await snapshot(page);
    expect(afterEvasive.player?.returnReason).toBe("evasive");
    expect(afterEvasive.player?.returnReason).not.toBe("blunt");
  });

  test("round two: a touch tap on Return to Io leaves every return tone unconsumed", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    await page.goto(`/aftersign/?slot=return-to-io-round-two-${Date.now()}`, {
      waitUntil: "load",
    });

    await deliverFirstPacket(page);
    await tapChoice(page, "return-to-io");
    await assertUntonedRecognitionAfterReturn(page);

    // Choose an actual tone to reach Io's next-job surface, then take the
    // second packet through the visible controls a player touches.
    await tapChoice(page, "choose-return-tone");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "accept-second-packet");
    await tapChoice(page, "deliver-packet");

    // The round-two board exposes its route choice before delivery.
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-night-transfer").tap();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    const beforeReturn = await snapshot(page);
    expect(beforeReturn.player?.returnReason ?? null).not.toBe("blunt");
    await tapChoice(page, "return-to-io");
    await assertUntonedRecognitionAfterReturn(page);
  });
});
