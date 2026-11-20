import { expect, test, type Page } from "@playwright/test";
import { clearLocalStorage } from "./clearLocalStorage";
import { recordSaveRequests, waitForLandedSave } from "./helpers/saveRequests";

// AFTERSIGN round-two `packet-offered` survives a hard navigation that
// loses localStorage (#2911 follow-up, PR #2914).
//
// Repro on base: play round one to `io-next-job` (ask-for-next-job saves
// that park to the Worker), tap "Deliver" to open round two at
// `packet-offered`. The client set the beat and only marked state dirty,
// so the Worker kept the `io-next-job` park. Clear localStorage (the
// `local-fallback` copy) and navigate back to the same slot + player:
// the restore came from the Worker and showed round one's park
// (`io-next-job`) instead of the round-two completed-branch tray.
//
// The fix awaits `forceSave()` right after `setBeat("packet-offered")`
// in aftersign/main.js `choose()`. This spec plays it with taps only and
// asserts what the player sees after the navigation: the
// `packet-offered` beat and the completed-branch tray, not the
// `io-next-job` park.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

// `COMPLETED_JOB_IDS` from packages/aftersign/src/computeOfferedJobs.ts,
// inlined as in aftersign-production-durable-authority.playtest.spec.ts.
const COMPLETED_JOB_IDS = ["job-night-transfer", "job-signed-receipt"] as const;

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
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

test.describe("AFTERSIGN round-two packet-offered restores from the Worker", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("after clearing localStorage, the round-two tray comes back, not round one's park", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const saves = recordSaveRequests(page);
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    // The player id lives in localStorage; name it in the URL so the
    // navigation after the clear restores the SAME player's Worker save.
    const url = `/aftersign/?slot=round-two-restore-${stamp}&player=e2e-r2-${stamp}`;
    await page.goto(url, { waitUntil: "load" });
    await waitForReady(page);

    // --- Round one, by taps (same path as the two-round spec). ---
    await waitForBeat(page, "packet-offered");
    const tray = page.locator("#offeredJobs");
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "fresh");
    const freshOffer = tray.locator("button[data-offered-job-id]");
    await expect(freshOffer).toHaveCount(1);
    await freshOffer.tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    // The Worker now holds round one's park.
    await waitForLandedSave(saves, "io-next-job");

    // --- Open round two. ---
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "completed");

    // Without the fix this save is never sent: the Worker keeps
    // `io-next-job` and this wait times out.
    await waitForLandedSave(saves, "packet-offered");

    // --- Hard navigation with localStorage gone: restore is Worker-only. ---
    await clearLocalStorage(page, WAIT_MS);
    await page.goto(url, { waitUntil: "load" });
    await waitForReady(page);

    // Round one's park must not come back.
    await expect(page.locator('[data-beat-id="io-next-job"]')).toHaveCount(0);
    await waitForBeat(page, "packet-offered");
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "completed");
    const restoredOffers = tray.locator("button[data-offered-job-id]");
    await expect(restoredOffers).toHaveCount(COMPLETED_JOB_IDS.length);
    const restoredIds = await restoredOffers.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute("data-offered-job-id")),
    );
    expect(restoredIds).toEqual([...COMPLETED_JOB_IDS]);
    await expect(restoredOffers.first()).toBeVisible();
  });
});
