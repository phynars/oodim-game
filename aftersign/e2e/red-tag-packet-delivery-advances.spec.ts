import { expect, test, type Page } from "@playwright/test";

// #2829 — the round-two red tag retains its packet gesture. The served
// spec reaches it through the visible touch flow and proves its tap gives a
// named, visible confirmation instead of silently re-rendering the label.

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

async function reachRoundTwoRedTag(page: Page, slotPrefix: string) {
    const slot = `${slotPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await expect(page.locator("#line")).toBeVisible();
    await expect(page.locator("#deliverButton")).toBeVisible();

    // Round one: deliver the first (blue) packet via the shipped
    // pointer-driven taps. The regression is on the round-two red-tag
    // seal, not the first-packet funnel.
    await tap(page, "#packetButton");
    await tap(page, "#deliverButton");
    await expect(page.locator("#deliverButton")).toHaveText("Return to Io");
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

    await waitForBeat(page, "packet-offered");
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    return packetButton;
}

test.describe("AFTERSIGN red-tag round-two confirmation (#2829, #2356)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // #2829 — tap the visible red-tag tile. Main keeps the original label
  // after this gesture, so the confirmation assertion fails there; the fix
  // names the successful seal on the tile.
  test("round-two red-tag delivery waits for Return to Io and has no stale listened receipt", async ({ page }) => {
    const packetButton = await reachRoundTwoRedTag(page, "red-tag-tap");
    await tap(page, "#packetButton");
    await expect(packetButton).toHaveText("Red tag — Saint Orra · seal confirmed");
    await waitForBeat(page, "packet-choice");
    await tap(page, "#deliverButton");
    await expect(page.locator("#deliverButton")).toHaveText("Return to Io");
    await expect(page.getByText("You listened", { exact: true })).toHaveCount(0);
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
  });

  // #2356 — NON-POINTER activation. Playwright's tap/click dispatch a
  // pointer stream that hits the pointerdown/pointerup funnel in
  // `inputAdapters.js`; only focus() + keyboard Enter on the focused
  // `<button>` exercises the `click` listener (detail === 0, no pointer
  // events). Without that listener this activation is a no-op and the beat
  // stays at `packet-offered`.
  test("round-two red-tag commits via keyboard activation (no pointer stream)", async ({
    page,
  }) => {
    const packetButton = await reachRoundTwoRedTag(page, "red-tag-keyboard");
    await packetButton.focus();
    await page.keyboard.press("Enter");
    await waitForBeat(page, "packet-choice");
    await expect(packetButton).toHaveText("Red tag — Saint Orra · seal confirmed");
  });
});
