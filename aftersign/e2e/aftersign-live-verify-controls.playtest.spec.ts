import { expect, test, type Page } from "@playwright/test";

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

async function reachPacketChoice(page: Page): Promise<void> {
  // Mirror the proven path from `aftersign-mloop-two-round.playtest.spec.ts`:
  // wait for the scene to be ready, wait for `packet-offered`, tap the
  // served offered-job button (NOT a `data-choice-id` selector — that
  // attribute isn't stamped on the offered-jobs tray), tap `#packetButton`,
  // and finally wait for the `packet-choice` beat before the caller asserts
  // on `#acknowledgeRouteButton` / `#soundButton`.
  await page.goto(`/aftersign/?slot=live-verify-${Date.now()}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  const offered = page.locator(
    'button[data-offered-job-id="job-safe-delivery"]',
  );
  await expect(offered).toBeVisible({ timeout: WAIT_MS });
  await offered.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
}

test.describe("AFTERSIGN live-verify control and save path", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player sees explicit selected labels and a separate reset control", async ({ page }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page);

    // Current main labels the route-memory fork "I listened" / "I ran
    // early" (the first-person stance Io is asking about). After the
    // tap the label flips to its past-tense receipt — the player sees
    // "You listened" over the warm selected tile. The TEXT is the
    // receipt; the inline bg/border + aria-pressed are the state.
    const acknowledge = page.locator("#acknowledgeRouteButton");
    await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
    await expect(acknowledge).toHaveText("I listened");
    await acknowledge.tap();
    await expect(acknowledge).toHaveAttribute("aria-pressed", "true");
    await expect(acknowledge).toHaveText(/you listened/i);

    const sound = page.locator("#soundButton");
    await expect(sound).toBeVisible({ timeout: WAIT_MS });
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await expect(sound).toHaveText(/sound on/i);

    // The reset control is isolated into its own `.slice-save-controls`
    // row so a mis-aimed thumb reaching for the sound tile cannot
    // trigger a slice wipe. Absence from `.controls` + presence under
    // the save-controls selector is the live assertion.
    await expect(page.locator(".controls #resetButton")).toHaveCount(0);
    await expect(page.locator(".slice-save-controls #resetButton")).toHaveText(
      "Start fresh",
    );
  });
});
