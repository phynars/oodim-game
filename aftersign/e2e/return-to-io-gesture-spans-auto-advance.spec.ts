import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN served-page spec for #2181 (blind AI-stranger playtest #3).
//
// Bug on main: `deliverPacket()` auto-advances `packet-delivered` →
// `io-return-recognition` ~1180ms after delivery, and the SAME
// `#deliverButton` is re-labelled in place from "Return to Io" to
// "Blunt return". A gesture that starts on "Return to Io" and ends after
// the swap fires a click on the re-labelled control and commits a blunt
// return the player never chose. In playtest #3 this landed in ROUND 2:
// one tap on "Return to Io" consumed "Blunt return" and Io's next recap
// read blunt. #2178 fixed only an explicit-tap path in round 1.
//
// The gate this spec pins, in BOTH rounds: a gesture that began before the
// recognition beat cannot commit a tone; a deliberate tap on a tone that is
// already showing still commits normally.
//
// The pointer is held with `page.mouse.down()` on "Return to Io" and
// released only after the button has become a tone control. The release
// waits past the 120ms settle gate (Date-based waitForFunction, not
// waitForTimeout) so the settle gate alone cannot be what refuses it.

type Snap = {
  scene?: { beat?: string };
  player?: { returnReason?: string | null };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => Snap;
      input?: { waitForStoryIdle?: () => unknown | Promise<unknown> };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 20_000;
const SPEC_TIMEOUT_MS = 180_000;
const HOLD_PAST_SETTLE_MS = 400;

async function snapshot(page: Page): Promise<Snap> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: WAIT_MS });
  await page.evaluate(async () => {
    await window.__game?.input?.waitForStoryIdle?.();
  });
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`), `story should reach "${beatId}"`).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

// Finger down on "Return to Io", hold through the auto-advance re-label,
// lift on the tone control. Must commit nothing.
async function holdReturnToIoThroughAutoAdvance(page: Page, label: string): Promise<void> {
  const returnToIo = page.locator('#deliverButton[data-choice-id="return-to-io"]');
  await expect(returnToIo, `${label}: "Return to Io" is offered at packet-delivered`).toBeVisible({ timeout: WAIT_MS });
  const box = await returnToIo.boundingBox();
  expect(box, `${label}: "Return to Io" has a box`).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(page.locator("#deliverButton"), `${label}: the held button is re-labelled as a tone`).toHaveAttribute(
    "data-choice-id",
    "choose-return-tone",
    { timeout: WAIT_MS },
  );
  const releaseAfter = await page.evaluate((ms) => Date.now() + ms, HOLD_PAST_SETTLE_MS);
  await page.waitForFunction((deadline) => Date.now() >= deadline, releaseAfter, { timeout: WAIT_MS });
  await page.mouse.up();
}

async function deliverFromPacketChoice(page: Page): Promise<void> {
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
}

test.describe("AFTERSIGN #2181 — a gesture begun on 'Return to Io' never commits a tone", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("rounds 1 and 2: holding through the auto-advance commits no tone; a deliberate tone tap still commits", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    await page.goto(`/aftersign/?slot=return-to-io-gesture-${Date.now()}`, { waitUntil: "load" });

    // ROUND 1
    await waitForBeat(page, "packet-offered");
    await page.locator("#packetButton").click();
    await deliverFromPacketChoice(page);
    await holdReturnToIoThroughAutoAdvance(page, "round 1");
    const r1 = await snapshot(page);
    expect(r1.scene?.beat, "round 1: still choosing a tone").toBe("io-return-recognition");
    expect(r1.player?.returnReason ?? null, "round 1: no tone was chosen").toBeNull();

    await page.locator('button[data-return-reason="kind"]').first().tap();
    await waitForBeat(page, "return-tone-choice");
    expect((await snapshot(page)).player?.returnReason, "round 1: the deliberate Kind tap commits").toBe("kind");

    // ROUND 2 — the path the blind playtest took.
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    const offer = page.locator("button[data-offered-job-id]:visible").first();
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await offer.tap();
    const packet = page.locator("#packetButton");
    await expect(packet).toBeEnabled({ timeout: WAIT_MS });
    await packet.tap();
    await deliverFromPacketChoice(page);
    await holdReturnToIoThroughAutoAdvance(page, "round 2");
    const r2 = await snapshot(page);
    expect(r2.scene?.beat, "round 2: still choosing a tone").toBe("io-return-recognition");
    expect(r2.player?.returnReason, "round 2: the held gesture must not overwrite round 1's kind with blunt").toBe("kind");

    await page.locator('button[data-return-reason="evasive"]').first().tap();
    await waitForBeat(page, "return-tone-choice");
    expect((await snapshot(page)).player?.returnReason, "round 2: the deliberate Evasive tap commits").toBe("evasive");
  });
});
