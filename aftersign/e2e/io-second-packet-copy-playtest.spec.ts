import { expect, test, type Page } from '@playwright/test';

// M-CONTINUE second packet copy playtest.
//
// This spec drives the shipped story slice EXCLUSIVELY through what a
// phone player can see and tap — the boot `#packetButton` gesture and
// the [data-choice-id] stamps stamped by aftersign/main.js renderText().
// The initial draft of this file used spec-authored choice ids
// (`listen-to-io`, `keep-seal`, `deliver-sealed`, `return-to-io`,
// `kind-return`) that renderText() never stamps — those tap targets
// don't exist in the served DOM. Fixed against the real stamped ids
// documented in phone-tap-visible-choice.spec.ts and
// docs/flagship/story-state-contract.md:
//
//   packet-offered         → tap #packetButton (fast tap = SEALED)
//   packet-choice          → acknowledge-kiosk / skip-kiosk-acknowledge
//                            → deliver-packet
//   packet-delivered       → auto-advance (~1180ms) — no player input
//   io-return-recognition  → choose-return-tone (×3 tone buttons)
//   return-tone-choice     → ask-for-next-job
//   io-next-job            → terminal for this spec; carries the
//                            actionable next-packet copy
//
// `return-to-io` is a harness `input.choose()` id, not a rendered
// [data-choice-id] — there is no DOM affordance to tap for it, so
// this spec doesn't try. The transition from packet-delivered to
// io-return-recognition happens automatically via a setTimeout in
// deliverPacket().

const PHONE_VIEWPORT = { width: 390, height: 844 };
const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapVisibleChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice, `choice "${choiceId}" is rendered for player input`).toBeVisible({
    timeout: WAIT_MS,
  });
  await choice.click();
}

async function expectVisibleStoryText(page: Page, pattern: RegExp, label: string): Promise<void> {
  await expect(page.getByText(pattern).first(), label).toBeVisible({ timeout: WAIT_MS });
}

test.describe('M-CONTINUE second packet copy', () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test('player can ask for the next job and see Io hand off the second packet copy', async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    await page.goto(`?slot=io-second-packet-copy-${Date.now()}`, { waitUntil: 'load' });

    // Boot beat — the story line stamps `packet-offered` as soon as
    // renderText() runs for the first time. Waiting on it also
    // confirms the DOM bridge is live before we drive any input.
    await waitForBeat(page, 'packet-offered');

    // Commit the packet gesture the way a phone player does. A fast
    // tap on the visible packet button preserves the seal
    // (PacketIntentController: press + fast release ⇒ SEALED ⇒
    // commitPacketOutcome ⇒ setBeat("packet-choice")). This is the
    // ONLY pre-bridge input surface in the slice; every subsequent
    // step goes through [data-choice-id] taps.
    await page.locator('#packetButton').click();
    await waitForBeat(page, 'packet-choice');

    // Second deliberate kiosk action (records `secondAction: "done"`),
    // then hand off the packet — both via the stamped choice ids.
    await tapVisibleChoice(page, 'acknowledge-kiosk');
    await tapVisibleChoice(page, 'deliver-packet');
    await waitForBeat(page, 'packet-delivered');

    // deliverPacket() auto-advances to the recognition beat after the
    // beat envelope closes (~1180ms). No player input exists or is
    // needed here — just wait for the beat stamp to flip.
    await waitForBeat(page, 'io-return-recognition');

    // Io's return recognition is the human-readable proof that we
    // arrived on the continuation branch before we ask for the next
    // job.
    await expectVisibleStoryText(
      page,
      /you came back/i,
      'Io return recognition is visible before the continuation beat',
    );

    // Pick a return tone (kind/evasive/blunt all share the same
    // stamped choice id) and then ask for the next job — both real
    // rendered choices.
    await tapVisibleChoice(page, 'choose-return-tone');
    await waitForBeat(page, 'return-tone-choice');

    await tapVisibleChoice(page, 'ask-for-next-job');
    await waitForBeat(page, 'io-next-job');

    // The whole point of the playtest: Io's io-next-job copy must be
    // ACTIONABLE — it names the second packet, the recipient, or a
    // location the player can act on. If this text drifts to
    // something vague, this assertion fails and we notice.
    await expectVisibleStoryText(
      page,
      /second packet|next job|bell archive|saint orra|moth pier/i,
      'Io visibly gives the player actionable copy for the next packet',
    );
  });
});
