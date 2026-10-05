import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN served-page spec for #2174.
//
// Bug on main (deployed 11aa3ef, blind AI-stranger playtest #2):
// the player tapped "Return to Io", then "Evasive return"; Io
// replied with the BLUNT line ("Good. Wanting is easier to route
// than pretending.") and later said "last time you told me straight."
// The player never chose a blunt return. False memory → M-LOOP
// closeout bar fails.
//
// Root cause (#2174): the `deliverButton` DOM element is REUSED
// across beats — at `packet-delivered` it carries
// `data-choice-id="return-to-io"` (label "Return to Io"); at
// `io-return-recognition` the SAME element is re-stamped with
// `data-choice-id="choose-return-tone"` + `data-return-reason="blunt"`
// (label "Blunt return"). A single player tap on "Return to Io" can
// synthesise a native click against the re-rendered node after the
// beat flip, so the click handler reads the fresh `data-return-reason`
// and commits "blunt" — the player's "Return to Io" gesture is
// reinterpreted as a blunt tone commit. The `choose-return-tone`
// settle gate (`RECOGNITION_SETTLE_MS`, main.js) exists exactly to
// stop this, but it only works when `state.interaction.recognitionEnteredAt`
// is stamped on entry to `io-return-recognition`.
//
// Fix: all three return-surface click handlers now STAGE the DOM-read
// reason onto `state.interaction.pendingReturnReason`; main.js's
// `choose-return-tone` branch commits the pending reason only AFTER
// both the beat guard and the settle gate pass; the `return-to-io`
// path stamps `state.interaction.recognitionEnteredAt` in the input
// adapter before dispatching the choice so the settle gate has a
// reliable `now - entry` delta.
//
// Acceptance (#2174): a served-page pointer-tap spec that FAILS on
// main — tap "Return to Io" by pointer and assert that
// `state.player.returnReason` is still unset afterwards and that no
// tone reply line is shown until a tone button is tapped.

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
      input?: {
        waitForStoryIdle?: () => unknown | Promise<unknown>;
      };
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
  await choice.tap();
}

test.describe("AFTERSIGN #2174 — Return to Io does not silently record a blunt tone", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tapping 'Return to Io' leaves player.returnReason unset; evasive tap records evasive, never blunt", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    await page.goto(`/aftersign/?slot=return-to-io-no-false-blunt-${Date.now()}`, {
      waitUntil: "load",
    });

    // Drive to the `packet-delivered` beat the way a phone player
    // does — the DOM-visible tap route is the same as
    // phone-tap-visible-choice.spec.ts. We tap the packet button to
    // preserve the seal (SEALED outcome), tap acknowledge-kiosk, then
    // tap `deliver-packet` on the `deliverButton` surface.
    await waitForBeat(page, "packet-offered");
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    // At `packet-delivered` the SAME `#deliverButton` carries
    // `data-choice-id="return-to-io"` (per
    // apps/web/src/aftersign/mContinueVisibleButtons.contract.test.ts).
    // Tap it by the stamped choice id — this is the player gesture
    // the bug reproduced from.
    //
    // PR #2184 iter-6 (phone-fit chain re-review): we DO NOT call
    // `snapshot(page)` here because that runs `waitForStoryIdle`,
    // which awaits in-flight timers — and `deliverPacket()` in
    // `aftersign/main.js` schedules a ~1180ms `setBeat(
    // "io-return-recognition")` auto-advance the moment the
    // `deliver-packet` tap commits. If we wait for story-idle at
    // `packet-delivered`, the auto-advance races the player tap
    // and the `#deliverButton` has already been re-stamped as a
    // tone control by the time our `return-to-io` locator resolves:
    // the explicit `choose("return-to-io")` becomes a no-op (we're
    // already past that beat) and `io-return-recognition` never
    // re-stamps, failing the next `waitForBeat`. Reading
    // `getSnapshot()` directly skips the idle wait and still proves
    // the sanity "no tone has been chosen yet" invariant; the player
    // tap then wins the race against the auto-advance.
    await waitForBeat(page, "packet-delivered");
    await waitForGame(page);
    const sanityBefore = await page.evaluate(() => window.__game!.getSnapshot!());
    expect(
      sanityBefore.player?.returnReason ?? null,
      "returnReason must be unset before the player ever taps a tone",
    ).toBeNull();

    await tapChoice(page, "return-to-io");

    // The runtime advances to `io-return-recognition` and re-stamps
    // `#deliverButton` as the "Blunt return" tone control. The bug
    // on main would synthesise a native click against the re-rendered
    // node and commit `returnReason = "blunt"` right here. The gate
    // this spec pins:
    await waitForBeat(page, "io-return-recognition");
    const afterReturnToIo = await snapshot(page);
    expect(
      afterReturnToIo.player?.returnReason ?? null,
      "returnReason must still be unset after Return to Io; no tone was tapped yet",
    ).toBeNull();
    expect(
      afterReturnToIo.scene?.beat,
      "beat must be at io-return-recognition after Return to Io",
    ).toBe("io-return-recognition");

    // The evasive tone button carries `data-return-reason="evasive"`
    // on one of the three recognition-beat tone controls. Locate by
    // that attribute (independent of which DOM node it lands on,
    // since the three tone labels round-robin across the reused
    // return-surface buttons).
    const evasive = page
      .locator('button[data-return-reason="evasive"]:not([disabled])')
      .first();
    await expect(evasive).toBeVisible({ timeout: WAIT_MS });
    await evasive.tap();

    await waitForBeat(page, "return-tone-choice");
    const afterEvasive = await snapshot(page);
    expect(
      afterEvasive.player?.returnReason,
      "returnReason must be 'evasive' after the evasive tap, not 'blunt'",
    ).toBe("evasive");
  });
});
