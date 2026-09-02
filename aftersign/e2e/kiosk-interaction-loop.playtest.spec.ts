import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN kiosk interaction loop — played, not driven.
//
// The kiosk scene earns product credit only when the player can approach a
// visible kiosk/booth/counter prompt, activate it by touch/keyboard-class input,
// and see a deterministic event on the public story-state surface. Reads from
// window.__game are assertions only; this spec never calls window.__game.input.*.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";
const SAFE_DELIVERY_ACTION_ID = "mloop-safe-delivery-take";
const SAFE_DELIVERY_EVENT_ID = `${SAFE_DELIVERY_ACTION_ID}:job-safe-delivery`;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function readLastInteractionAction(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const action = (
      window as unknown as {
        __game?: { interaction?: { lastAction?: unknown } };
      }
    ).__game?.interaction?.lastAction;
    return typeof action === "string" ? action : null;
  });
}

test.describe("AFTERSIGN kiosk interaction loop", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("phone player taps the kiosk offer and emits a deterministic window.__game event", async ({
    page,
  }) => {
    const slot = `kiosk-interaction-loop-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const kioskPrompt = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    await expect(
      kioskPrompt,
      "the kiosk prompt must be visible before the player can activate it",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(kioskPrompt).toHaveAttribute(
      "data-aftersign-job-take-action",
      SAFE_DELIVERY_ACTION_ID,
    );

    // Real player activation: touch the visible kiosk prompt. Do not use
    // window.__game.input.* or any private runtime seam to commit it.
    await kioskPrompt.tap();

    await expect
      .poll(() => readLastInteractionAction(page), { timeout: WAIT_MS })
      .toBe(SAFE_DELIVERY_EVENT_ID);
    await expect(kioskPrompt).toHaveAttribute("data-aftersign-job-take", "armed");
  });
});
