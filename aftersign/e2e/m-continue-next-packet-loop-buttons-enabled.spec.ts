import { expect, test } from "@playwright/test";

// AFTERSIGN M-CONTINUE next-packet loop — BUTTON AFFORDANCE regression.
//
// Sibling spec `m-continue-next-packet-loop.spec.ts` asserts the story
// *reaches* each beat via `[data-beat-id]`. This spec adds the FEEL
// assertion the sibling doesn't: at every beat, the choice control the
// player is expected to tap is visibly rendered AND not disabled — i.e.
// enters that beat in a tappable state, no dead frame between beat
// stamp and control affordance.
//
// Selectors mirror the shipped surface (playerVisibleBeatDom.js,
// windowGameSurface.ts): `[data-beat-id]` for the story line stamp,
// `button[data-choice-id]` for choice buttons, `button[data-return-reason]`
// for the return-tone fork, `#packetButton` for the packet tap.
// Soren PR #1298 REQUEST_CHANGES: prior draft asserted an invented
// `data-aftersign-beat` attribute — swapped for the shipped `data-beat-id`
// idiom the sibling specs already use.

const WAIT_MS = 10_000;
const COLD_START_MS = 20_000;

test.describe("AFTERSIGN M-CONTINUE next-packet loop — button affordance", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("every next-packet-loop beat lands with its expected choice visible AND enabled", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `m-continue-next-packet-loop-buttons-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    const waitForBeat = async (beatId: string) => {
      await expect(
        page.locator(`[data-beat-id="${beatId}"]`),
        `story line should visibly reach beat "${beatId}"`,
      ).toBeVisible({ timeout: WAIT_MS });
    };

    const expectChoiceEnabled = async (choiceId: string) => {
      const choice = page.locator(`button[data-choice-id="${choiceId}"]`).first();
      await expect(choice, `choice "${choiceId}" should be visible on arrival`).toBeVisible({ timeout: WAIT_MS });
      await expect(choice, `choice "${choiceId}" should be enabled on arrival (no dead frame)`).toBeEnabled({
        timeout: WAIT_MS,
      });
      return choice;
    };

    const expectReturnReasonEnabled = async (reason: string) => {
      const button = page.locator(`button[data-return-reason="${reason}"]`).first();
      await expect(button, `return-reason "${reason}" should be visible on arrival`).toBeVisible({ timeout: WAIT_MS });
      await expect(button, `return-reason "${reason}" should be enabled on arrival`).toBeEnabled({ timeout: WAIT_MS });
      return button;
    };

    // packet-offered → packet tap is visible + enabled.
    await waitForBeat("packet-offered");
    const packetButton = page.locator("#packetButton");
    await expect(packetButton, "packet button should be visible at packet-offered").toBeVisible({ timeout: WAIT_MS });
    await expect(packetButton, "packet button should be enabled at packet-offered").toBeEnabled({ timeout: WAIT_MS });
    await packetButton.click();

    // packet-choice → acknowledge-kiosk visible + enabled.
    await waitForBeat("packet-choice");
    await (await expectChoiceEnabled("acknowledge-kiosk")).click();

    // deliver-packet is the next tap in the same beat cluster; it must
    // stay enabled through the acknowledge transition.
    await (await expectChoiceEnabled("deliver-packet")).click();

    // io-return-recognition → return-tone "blunt" is enabled the moment
    // the recognition beat lands.
    await waitForBeat("io-return-recognition");
    await (await expectReturnReasonEnabled("blunt")).click();

    // return-tone-choice → ask-for-next-job is enabled.
    await waitForBeat("return-tone-choice");
    await (await expectChoiceEnabled("ask-for-next-job")).click();

    // io-next-job → deliver-packet is enabled (starts the SECOND packet).
    await waitForBeat("io-next-job");
    await (await expectChoiceEnabled("deliver-packet")).click();

    // PR #1398: the next-packet loop-back now resets to `packet-offered`
    // (not `packet-choice`) so the `#offeredJobs` render pipeline —
    // gated on that beat — re-opens visibly on lap 2. So the second lap
    // MUST first prove the packet tap is visible + enabled again, then
    // land on `packet-choice` with both branches tappable.
    await waitForBeat("packet-offered");
    await expect(packetButton, "packet button should be visible on lap 2 packet-offered").toBeVisible({
      timeout: WAIT_MS,
    });
    await expect(packetButton, "packet button should be enabled on lap 2 packet-offered").toBeEnabled({
      timeout: WAIT_MS,
    });
    await packetButton.click();

    // Second lap packet-choice → both branches are enabled (real
    // affordance: player must be able to CHOOSE, not just see one path).
    await waitForBeat("packet-choice");
    await expectChoiceEnabled("acknowledge-kiosk");
    await expectChoiceEnabled("skip-kiosk-acknowledge");
  });
});
