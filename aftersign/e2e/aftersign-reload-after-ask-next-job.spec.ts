import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN reload after "Ask for next job" (#2267, live-verify by Soren).
//
// Repro: tap Blue packet → "I listened" → Deliver → Kind return → Ask for
// next job. Io promises "Take the red tag to Saint Orra" and the three
// handoff buttons appear. Reload. On main, `state.delivery.id` was reset
// to "blue-packet" at boot (hard-coded default in the state constructor),
// so the packet button fell back to the idle blue copy applied at line
// ~824 (`applyPacketButtonCopy(packetButton, "idle")`) and never got
// re-labelled to "Red tag — Saint Orra" — even though the save on disk
// recorded `player.secondPacketHandoffAccepted = true` and the next-job
// handoff beat.
//
// The fix (#2268) restores `delivery.id` from the save (falling back to
// `secondPacketHandoffAccepted` for pre-fix saves) and re-applies the
// red-tag label on `#packetButton` AFTER the idle copy stamp so ordering
// can't clobber it. This spec drives only visible elements — the packet
// button text and its `data-packet-job` dataset — so it would catch the
// bug the next time someone regresses either half of the fix.
//
// Scope: this covers the FIRST symptom in #2267 (reload between accepting
// the handoff and tapping the packet). The second symptom (reload AFTER
// a completed red-tag delivery still showing a fresh blue round-1
// packet) is NOT covered here — it belongs to a follow-up because the
// post-delivery state is further along the beat chain and needs its own
// save-restoration audit. PR #2268 is Refs #2267, not Closes.

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

// Reach `io-next-job` — the beat where Io has just promised the red tag
// to Saint Orra and the three handoff buttons are visible. Mirrors the
// round-one walk in `aftersign-mloop-two-round.playtest.spec.ts:82-93`:
// packet → "I listened" (acknowledge-kiosk) → deliver-packet →
// recognition → blunt return → ask-for-next-job → deliver-packet.
async function reachNextJobFromBoot(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");

  // Tap the blue packet → packet-choice.
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");

  // "I listened" — the real choice id is `acknowledge-kiosk`, NOT
  // `keep-seal`. See aftersign-mloop-two-round.playtest.spec.ts:84-86.
  const acknowledge = page.locator(
    'button[data-choice-id="acknowledge-kiosk"]',
  );
  await expect(acknowledge).toHaveText("I listened");
  await acknowledge.tap();

  // Deliver packet → io-return-recognition.
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  // Return tone — pick the blunt reason (same as the sibling spec).
  await page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .tap();
  await waitForBeat(page, "return-tone-choice");

  // Ask Io for the next job → io-next-job.
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN reload after 'Ask for next job' keeps red tag (#2267)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("after reload at io-next-job, #packetButton shows 'Red tag — Saint Orra'", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const slot = `reload-after-next-job-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await reachNextJobFromBoot(page);

    const packetButton = page.locator("#packetButton");

    // In-session the red-tag label is already applied by the
    // `ask-for-next-job` handler. Assert it so the spec fails loudly
    // if a future refactor also breaks the in-session relabel — not
    // just the reload path.
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await expect(packetButton).toHaveAttribute("data-packet-job", "red-tag");

    // Reload the same slot — this re-runs boot and the state
    // constructor that hard-coded `delivery.id = "blue-packet"` on main.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-next-job");

    // The two visible, player-facing assertions the reviewer asked for.
    // On main these FAIL: the button fell back to the idle blue copy
    // because `delivery.id` was reset to "blue-packet" and the
    // boot-time re-label at line ~1280 didn't exist yet.
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await expect(packetButton).toHaveAttribute("data-packet-job", "red-tag");
  });
});
