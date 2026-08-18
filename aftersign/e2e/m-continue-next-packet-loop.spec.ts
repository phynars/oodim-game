import { expect, test } from "@playwright/test";

// AFTERSIGN M-CONTINUE next-packet loop.
//
// History: the previous rewrite (#1303, first pass) traded the shipped-
// surface `[data-beat-id]` / `[data-choice-id]` / `[data-return-reason]`
// selectors for `getByRole("button", { name: /blunt|work|job|back|because/i })`
// and `page.goto("/")`. That version had five blocking defects flagged
// by review:
//
//   1. `page.goto("/")` navigated to the vite-preview root, not the
//      game — the aftersign build serves at `base: "/aftersign/"`
//      (vite.config.ts) so every sibling spec uses `/aftersign/?slot=…`.
//   2. `await game?.input?.waitForStoryIdle?.()` silently no-op'd when
//      `__game` was undefined (optional-chain → `undefined` → `await
//      undefined` resolves instantly). The real quiescence gate is
//      `waitForFunction(() => __game?.scene?.ready === true)`.
//   3. No `?slot=` → collided with the shared server-authoritative save
//      (see the m-continue-next-job-played.spec.ts note about this).
//   4. The recognition-beat regex `/blunt|work|job|back|because/i` did
//      not match the served labels "Kind return" / "Evasive return" /
//      "Blunt return" (main.js:1406-1408). Only "blunt" matched at all,
//      and only inside one label — the other alternates were dialogue
//      words, not control labels.
//   5. Terminal assertions were loose visibility-of-buttons checks
//      instead of a `[data-beat-id="packet-choice"]` re-arrival that
//      actually proves the loop closed.
//
// This is the shipped-surface pattern used by every sibling spec:
// `#packetButton` for the packet tap, `button[data-choice-id]` for
// choice buttons, `button[data-return-reason]` for the return-tone
// fork, and `[data-beat-id]` to gate on story-beat arrival. All ids
// match the served vocabulary (main.js publishState +
// windowGameSurface.ts AftersignStoryBeatId).

const WAIT_MS = 10_000;
const COLD_START_MS = 20_000;

test.describe("AFTERSIGN M-CONTINUE next-packet loop", () => {
  test("io-next-job lets the player start the next packet instead of re-delivering the old one", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `m-continue-next-packet-loop-${Date.now()}`;
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
    const tapChoice = async (choiceId: string) => {
      const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
      await expect(choice, `choice "${choiceId}" should be visible and tappable`).toBeVisible({ timeout: WAIT_MS });
      await choice.click();
    };

    await waitForBeat("packet-offered");
    await page.locator("#packetButton").click();
    await waitForBeat("packet-choice");

    await tapChoice("acknowledge-kiosk");
    await tapChoice("deliver-packet");
    await waitForBeat("io-return-recognition");

    const toneButton = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
    await expect(toneButton, "return-tone button should stay visible after recognition").toBeVisible({
      timeout: WAIT_MS,
    });
    await toneButton.click();
    await waitForBeat("return-tone-choice");

    await tapChoice("ask-for-next-job");
    await waitForBeat("io-next-job");

    await tapChoice("deliver-packet");
    await waitForBeat("packet-choice");

    await expect(page.locator('button[data-choice-id="acknowledge-kiosk"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator('button[data-choice-id="deliver-packet"]')).toHaveText(/Deliver packet/i);
  });
});
