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

type InteractionSnapshot = {
  lastAction?: string | null;
};

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
        __game?: { interaction?: InteractionSnapshot };
      }
    ).__game?.interaction?.lastAction;
    return typeof action === "string" ? action : null;
  });
}

async function bootPhoneKiosk(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN kiosk interaction loop", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("phone player taps the kiosk offer and emits a deterministic window.__game event", async ({
    page,
  }) => {
    await bootPhoneKiosk(page, `kiosk-interaction-loop-${Date.now()}`);

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

  test("a phone drag over the kiosk does not activate it on press", async ({ page }) => {
    await bootPhoneKiosk(page, `kiosk-drag-guard-${Date.now()}`);

    const kioskPrompt = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    await expect(kioskPrompt).toBeVisible({ timeout: WAIT_MS });
    const box = await kioskPrompt.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("visible kiosk prompt has no bounding box");

    // A deliberate 24px swipe begins and ends on the visible target. It must
    // remain camera/look input rather than becoming an interaction tap.
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 24, y);
    await page.mouse.up();

    // The pre-fix adapter activated on pointerdown; the guarded runtime must
    // leave a fresh scene untouched until a genuine no-travel tap occurs.
    expect(await readLastInteractionAction(page)).toBeNull();
  });
});
