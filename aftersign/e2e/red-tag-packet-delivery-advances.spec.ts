import { expect, test, type Page } from "@playwright/test";

// #2356 — AFTERSIGN red-tag round-two keyboard activation.
//
// WHY A KEYBOARD SPEC. The round-two bug is a NON-POINTER activation
// gap: the shipped pointerdown/pointerup funnel in `inputAdapters.js`
// already commits SEALED for mouse + touch play, so Playwright's
// `locator.click()` (which dispatches a full pointer sequence) does
// NOT exercise the newly-added `click` listener — it hits the pointer
// funnel instead and would pass on main too. The dead-affordance
// symptom players report only shows up when activation arrives
// without a pointer stream: `HTMLElement.click()` or keyboard
// Enter/Space on the focused `<button>`.
//
// This spec drives the real non-pointer path: `focus()` +
// `keyboard.press("Enter")` on `#packetButton` at the round-two
// red-tag beat. On the base branch no `click` listener is attached,
// so the keyboard activation is a no-op and the beat STAYS at
// `packet-offered` — the `waitForBeat("packet-choice")` call times
// out and the spec FAILS (the required base-branch failure for a
// bug-issue PR). After the fix the keyboard activation routes
// through `commitPacketOutcome(SEALED)` — the same funnel the
// pointer path uses — and the beat advances to `packet-choice`.
//
// SCAFFOLDING. Mirrors `io-second-packet-copy-served.spec.ts`
// exactly — `waitForReady` + `#deliverButton` / `#packetButton`
// taps + beat-based polling. The earlier draft of this spec used
// `getByRole("button", { name: "Safe delivery · low risk" })` which
// can race the harness boot and stall the whole spec to the 30s
// global timeout; the proven scaffolding below does not stall.

const WAIT_MS = 10_000;

type FlagshipReadOnlySnapshot = {
  scene: { beat: string };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipReadOnlySnapshot;
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

async function snapshot(page: Page): Promise<FlagshipReadOnlySnapshot> {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function tap(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(async () => (await snapshot(page)).scene.beat, { timeout: WAIT_MS })
    .toBe(beat);
}

test.describe("AFTERSIGN red-tag round-two keyboard activation (#2356)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("round-two red-tag commits via keyboard activation (no pointer stream)", async ({
    page,
  }) => {
    const slot = `red-tag-keyboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await expect(page.locator("#line")).toBeVisible();
    await expect(page.locator("#deliverButton")).toBeVisible();

    // Round one: deliver the first (blue) packet via the shipped
    // pointer-driven taps. The regression is on the round-two red-tag
    // seal, not the first-packet funnel.
    await tap(page, "#packetButton");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");

    // Choose a tone and return to Io so the round-two red-tag beat
    // renders. Blunt via `#deliverButton` is the shortest return path.
    await expect(page.locator("#deliverButton")).toHaveText("Blunt return");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "return-tone-choice");

    await expect(page.locator("#deliverButton")).toHaveText("Ask for next job");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    await expect(page.locator("#deliverButton")).toHaveText("Deliver next packet");
    await tap(page, "#deliverButton");

    // Now at round-two `packet-offered` with the red-tag label on
    // `#packetButton`. Drive the KEYBOARD path explicitly — focus +
    // Enter — which emits a `click` event with `detail === 0` and NO
    // pointer stream. On main the new `click` listener is absent, so
    // this activation is a no-op and `waitForBeat("packet-choice")`
    // below times out (base-branch failure proof). After the fix the
    // listener routes through `commitPacketOutcome(SEALED)`.
    await waitForBeat(page, "packet-offered");
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    await packetButton.focus();
    await page.keyboard.press("Enter");

    await waitForBeat(page, "packet-choice");
  });
});
