import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN served-page regressions for #2174 and #2181.
// A visible Return to Io tap must never become a Blunt return when the
// reused #deliverButton is restamped during the beat transition.
//
// Fails-on-main scope note (PR #2183 review follow-up — AI003/AI007):
// #2181's bug is a sub-frame race between the physical pointerup on
// `#deliverButton` and the beat flip that re-stamps the SAME DOM node
// with `data-choice-id="choose-return-tone"` + `data-return-reason="blunt"`.
// Playwright's `tap()` is one-shot and cannot reliably reproduce the
// race's exact pointer-vs-restamp interleave. What this spec DOES
// reproduce — and what fails on `main` without this PR — is the
// INPUT the race feeds on: `state.interaction.recognitionEnteredAt`
// stamped by round 1's `return-to-io` tap (see `stampRecognitionEntryIfReturnToIo`
// in `aftersign/src/runtime/inputAdapters.js`) and left stale across
// the ask-for-next-job → next-packet transition. On main, by the time
// the player's finger reaches round 2's `packet-delivered` beat, the
// stale stamp is far enough in the past that the `RECOGNITION_SETTLE_MS`
// gate in `main.js`'s `choose-return-tone` branch waves ANY staged
// `pendingReturnReason` through — including the "blunt" the re-stamp
// race writes. The round-two assertion below reads
// `state.interaction.recognitionEnteredAt` on the served snapshot right
// at `packet-delivered` of round 2 and asserts it is `null`: on main
// the slot retains round 1's `performance.now()` stamp and the test
// reds; on head the next-packet reset in `main.js` nulls it and the
// test greens. That is the DETERMINISTIC fails-on-main surface the
// race itself cannot produce via `tap()`.

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

// Round-one shape: the player has never tapped a return tone, so
// `player.returnReason` is unset. All three tone buttons must be live.
async function assertUntonedRecognitionAfterReturn(page: Page): Promise<void> {
  await waitForBeat(page, "io-return-recognition");
  const afterReturnToIo = await snapshot(page);
  expect(afterReturnToIo.player?.returnReason ?? null).toBeNull();
  expect(afterReturnToIo.interaction?.pendingReturnReason ?? null).toBeNull();
  await expect(
    page.locator('button[data-return-reason]:not([disabled])'),
  ).toHaveCount(3);
}

// Round-two shape: `player.returnReason` is DURABLE memory of the posture
// posted on the prior delivery (Io's second-packet copy reads it to diverge
// round 2 from round 1 — see `m-loop-two-round-divergence.playtest.spec.ts`
// and `selectIoSecondPacketCopyForReturnReason`). The round-2 `Return to Io`
// tap must NOT clobber it with a false blunt, and it must NOT null it: the
// prior tone has to still read as the previous posture, and the fresh return
// surface must still offer all three tones (so a new round-2 tone can be
// chosen on top of the kept memory). The only transient slot (`pendingReturn
// Reason`) is the one that must clear.
async function assertRoundTwoReturnKeepsPriorTone(
  page: Page,
  priorTone: "kind" | "evasive" | "blunt",
): Promise<void> {
  await waitForBeat(page, "io-return-recognition");
  const afterSecondReturnToIo = await snapshot(page);
  expect(afterSecondReturnToIo.player?.returnReason ?? null).toBe(priorTone);
  expect(afterSecondReturnToIo.interaction?.pendingReturnReason ?? null).toBeNull();
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

  test("round two: a touch tap on Return to Io keeps round-1's tone and never silently blunts", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    await page.goto(`/aftersign/?slot=return-to-io-round-two-${Date.now()}`, {
      waitUntil: "load",
    });

    // Round 1: deliver, Return to Io, then tap a REAL tone (kind) so
    // round 1 posts durable return-tone memory. Round 2 must preserve
    // that memory across the next-packet reset — this is exactly what
    // `main.js`'s next-packet branch keeps (`state.player.returnReason`
    // is durable, only `pendingReturnReason` + `recognitionEnteredAt`
    // clear). If a future change nulls `returnReason` on the next-packet
    // reset, this test will fail at the round-two assertion below.
    await deliverFirstPacket(page);
    await tapChoice(page, "return-to-io");
    await assertUntonedRecognitionAfterReturn(page);
    await tapChoice(page, "choose-return-tone");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "return-tone-kind");
    const afterKindReturn = await snapshot(page);
    expect(afterKindReturn.player?.returnReason).toBe("kind");

    // Round 1's `return-to-io` tap stamped
    // `state.interaction.recognitionEnteredAt` via
    // `stampRecognitionEntryIfReturnToIo` in
    // `aftersign/src/runtime/inputAdapters.js`. Before the fix, that
    // stamp survives into round 2 — any main.js build without the
    // next-packet reset carries a non-null `recognitionEnteredAt`
    // from here through the entire round-2 setup, up to and
    // including round 2's `packet-delivered` beat.
    const afterRound1Tone = await snapshot(page);
    expect(afterRound1Tone.interaction?.recognitionEnteredAt ?? null).not.toBeNull();

    // Move to the next-job surface, take the second packet, then run
    // through the round-two delivery via the visible controls a player
    // actually touches on a phone. One of these taps (the
    // ask-for-next-job → next-packet branch in `main.js`) carries the
    // reset block this PR adds — the exact tap doesn't matter for the
    // fails-on-main check further down, only that by round 2's
    // `packet-delivered` beat the slot is clear on head and stale on
    // main.
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

    // Round-two Return to Io: the one tap under test. Nothing is staged
    // yet (no tone button has been pressed on this beat), and the prior
    // "kind" tone must survive — but the surface must still offer all
    // three tone buttons so round 2 can post a new posture if the player
    // chooses one. A silent commit to "blunt" would show up as either
    // `returnReason === "blunt"` or as the Blunt tone button missing.
    //
    // Fails-on-main check at the round-2 `packet-delivered` seam: the
    // reused `#deliverButton` has just restamped to "Return to Io", and
    // `recognitionEnteredAt` must still be null (round 1's stamp was
    // cleared by the next-packet reset above; round 2's return-to-io
    // tap hasn't fired yet to stamp a fresh one). On main the slot
    // retains round 1's `performance.now()` and this reds.
    const beforeReturn = await snapshot(page);
    expect(beforeReturn.player?.returnReason).toBe("kind");
    expect(beforeReturn.interaction?.pendingReturnReason ?? null).toBeNull();
    expect(beforeReturn.interaction?.recognitionEnteredAt ?? null).toBeNull();
    await tapChoice(page, "return-to-io");
    await assertRoundTwoReturnKeepsPriorTone(page, "kind");
  });
});
