import { expect, test } from "@playwright/test";

// AFTERSIGN M-CONTINUE next-packet loop.
//
// History: an earlier rewrite (#1303, #1308 first pass) traded the
// shipped-surface `#packetButton` / `[data-beat-id]` / `[data-choice-id]`
// / `[data-return-reason]` selectors for `getByRole("button", { name:
// /keep.*seal|leave.*sealed|preserve/i })` and `page.goto("/aftersign/")`
// (no slot). Soren REQUEST_CHANGES on #1308 flagged five blocking
// defects:
//
//   1. No `?slot=` → collides with the shared server-authoritative save
//      that every sibling spec isolates via
//      `/aftersign/?slot=<spec>-${Date.now()}`.
//   2. No `__game.scene.ready` quiescence gate — taps could fire into
//      an un-hydrated scene.
//   3. Invented button-name regexes (`/keep.*seal|preserve/`,
//      `/route|listen/`, `/deliver|sign box/`, `/return|back to io|io/`)
//      matched NONE of the served labels — the shipped buttons are
//      "Deliver packet" (packet button), "Kind return" / "Blunt return"
//      / "Evasive return" (return-tone fork, main.js:1406-1408), and
//      choice-id-driven `[data-choice-id]` buttons like
//      "acknowledge-kiosk", "deliver-packet", "ask-for-next-job".
//   4. `await __game?.input?.waitForStoryIdle?.()` silently no-op'd
//      when `__game` was undefined (optional-chain → `undefined` →
//      `await undefined` resolves instantly).
//   5. Terminal assertion collapsed to `expect(state).toBeTruthy()` —
//      that only proves `window.__game` exists, NOT that the next-packet
//      loop actually closed and re-arrived at `packet-choice` with a
//      fresh set of `[data-choice-id]` buttons.
//
// This spec restores the shipped-surface pattern used by every sibling
// (see `m-continue-next-packet-loop-buttons-enabled.spec.ts` for the
// canonical style): `#packetButton` for the packet tap,
// `button[data-choice-id]` for choice buttons, `button[data-return-reason]`
// for the return-tone fork, and `[data-beat-id]` to gate on story-beat
// arrival. All ids match the served vocabulary
// (main.js publishState + windowGameSurface.ts AftersignStoryBeatId).

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

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
      await choice.click({ trial: true, timeout: WAIT_MS });
      await choice.click({ force: true, timeout: WAIT_MS });
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
    const nextPacketDeliver = page.locator('button[data-choice-id="deliver-packet"]:not([disabled])').first();
    await expect(nextPacketDeliver, "fresh packet deliver choice should be visible after the loop resets").toBeVisible({
      timeout: WAIT_MS,
    });
    await expect(nextPacketDeliver).toHaveText(/Deliver packet/i);
    await nextPacketDeliver.click({ trial: true, timeout: WAIT_MS });
  });
});
