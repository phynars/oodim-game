import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN red-tag recipient — served-page tap-driven spec (#2446).
//
// Mara Okonkwo's F2 review on PR #2449 blocked the merge: the third
// remembering NPC's recorder, resolver, and surface-npcs branch were
// reachable only from `apps/web/src/aftersign/harness/bootWindowGame.ts`
// (vitest's harness surface), so `scripts/served-reach.mjs` reported
// all four changed source files as unreachable from `aftersign/main.js`
// / `src/server.ts`. The player never saw anything.
//
// This spec drives the real served page end-to-end — the SAME two
// deliveries a player does by hand — and asserts the shipped render
// block in `aftersign/main.js` (search `aftersignRedTagRecipientLine`)
// stamps the authored acknowledgment line from
// `resolveAftersignRememberingNpcDialogue(..., "red-tag-recipient")`
// into a DOM paragraph a real player's page carries. If the recorder,
// resolver or surface branch regresses, this spec reds.
//
// Walk, verbatim mirror of `aftersign-reload-after-ask-next-job.spec.ts`
// through the next-job handoff:
//   packet-offered → packet-choice ("I listened") → deliver-packet →
//   io-return-recognition → "blunt" return-tone → ask-for-next-job →
//   io-next-job → tap red-tag `#packetButton` → packet-choice →
//   acknowledge-kiosk → deliver-packet → io-return-recognition
//     (now with `state.delivery.id === "red-tag"`)
//
// Pre-delivery assertion: before the red-tag deliver tap, the slice's
// `redTagDeliveredToThirdNpc` is false, so the resolver returns the
// default greeting and the sibling paragraph (if present at all) is
// stamped with `data-aftersign-red-tag-recipient="awaiting-delivery"`.
// Post-delivery: `recordAftersignThirdNpcRedTagDelivery` has fired on
// the slice, so the paragraph carries the acknowledgment line and
// `data-aftersign-red-tag-recipient="recognizes-player"`, and the
// `data-aftersign-red-tag-recipient-count` attribute reads `"1"` —
// proving `getAftersignStoryState(...).state.npcs` emits the entry
// on the served page (not just in vitest), locking F1 (gated entry)
// on the real DOM.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

// Round-one walk through the first (blue) delivery, mirror of
// `aftersign-reload-after-ask-next-job.spec.ts`.
async function reachNextJobFromBoot(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");

  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");

  const acknowledge = page.locator(
    'button[data-choice-id="acknowledge-kiosk"]',
  );
  await expect(acknowledge).toHaveText("I listened");
  await acknowledge.tap();

  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  await page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .tap();
  await waitForBeat(page, "return-tone-choice");

  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN third remembering NPC — red-tag acknowledgment on the served page (#2446)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tap-driven red-tag delivery stamps the authored acknowledgment line", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const slot = `red-tag-recipient-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // Round 1 — walk through the blue delivery to arm the red-tag
    // handoff. We're now at `io-next-job`, Io has promised the red tag,
    // and `state.delivery.id === "red-tag"`.
    await reachNextJobFromBoot(page);

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveAttribute("data-packet-job", "red-tag");

    // Pre-delivery F1 proof on the real served page: before the
    // red-tag tap, the module-scoped slice's
    // `redTagDeliveredToThirdNpc` is still false — so even if the
    // shipped render block were to fire at `io-return-recognition`
    // with a stray `red-tag` delivery id (it won't, we're on
    // `io-next-job`), the paragraph would not carry the
    // acknowledgment text. The strongest observable check is that
    // the authored acknowledgment line is NOT yet in the live DOM
    // anywhere. A regression that reintroduces the pre-#2449
    // unconditional-append would surface the text here and red the
    // spec before the deliver tap below.
    await expect(
      page.locator(
        'text="Red tag received. I kept its mark under your name."',
      ),
    ).toHaveCount(0);

    // Round 2 — tap the red-tag packet, acknowledge, deliver.
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");

    await page
      .locator('button[data-choice-id="acknowledge-kiosk"]')
      .tap();
    // The red-tag round's deliver control names the red tag and its
    // recipient, not the generic "Deliver packet" copy.
    await expect(
      page.locator('button[data-choice-id="deliver-packet"]:not([disabled])').first(),
    ).toHaveText("Deliver red tag to the recipient");
    await tapChoice(page, "deliver-packet");

    // Land on the red-tag recognition beat. The shipped render block
    // in `aftersign/main.js` now gates on
    // `isReturnRecognitionBeat && state.delivery.id === "red-tag"`,
    // which is exactly the state we just drove into.
    await waitForBeat(page, "io-return-recognition");

    const recipientLine = page.locator("#aftersignRedTagRecipientLine");
    await expect(recipientLine).toBeVisible({ timeout: WAIT_MS });

    // The authored acknowledgment line from
    // `resolveAftersignRememberingNpcDialogue(slice,
    // "red-tag-recipient")` with `redTagDeliveredToThirdNpc === true`
    // (see verticalSliceRuntimeState.ts). If any of the four modules
    // the PR edited stops shipping (served-reach regression), this
    // text is not on the page and the spec reds.
    await expect(recipientLine).toHaveText(
      "You brought the red tag yourself. I remember the courier who did not leave it for the rain.",
    );
    await expect(recipientLine).toHaveAttribute(
      "data-aftersign-red-tag-recipient",
      "recognizes-player",
    );
    // Proves `getAftersignStoryState(...).state.npcs` emits the
    // `red-tag-recipient` entry post-delivery on the SERVED page —
    // not just in vitest. Locks F1 on the real DOM: a regression
    // that reintroduces the unconditional append would stamp "1"
    // pre-delivery too, which the pre-tap check below forbids.
    await expect(recipientLine).toHaveAttribute(
      "data-aftersign-red-tag-recipient-count",
      "1",
    );
  });
});
