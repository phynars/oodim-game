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
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
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

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

// Reach `io-next-job` — the beat where Io has just promised the red tag
// to Saint Orra and the three handoff buttons are visible. Mirrors
// `reachNextJob` in `red-tag-packet-choice-retention.spec.ts`, but
// walking through the full round-1 blue-packet flow from a cold boot.
async function reachNextJobFromBoot(page: Page): Promise<void> {
  // packet-offered → tap the blue packet → packet-choice (keep seal)
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");

  // "I listened" (keep seal)
  const keepSeal = page.locator('button[data-choice-id="keep-seal"]');
  await expect(keepSeal).toBeVisible({ timeout: WAIT_MS });
  await keepSeal.tap();

  // Deliver packet → io-return-recognition
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-return-recognition");

  // Acknowledge the route (Kind return)
  await tap(page, "#acknowledgeRouteButton");
  await waitForBeat(page, "return-tone-choice");

  // Deliver next (Ask for next job) → io-next-job
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN reload after 'Ask for next job' keeps red tag (#2267)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("after reload at io-next-job, #packetButton shows 'Red tag — Saint Orra'", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const slot = `reload-after-next-job-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await reachNextJobFromBoot(page);

    // Sanity: in the same session, the handoff label already reads red tag.
    // (This isn't the regression — the regression is what happens on reload.)
    const packetButton = page.locator("#packetButton");

    // Reload the same slot — this re-runs boot and the state constructor
    // that hard-coded `delivery.id = "blue-packet"` on main.
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
