import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;
const IDLE_TEXT =
  "Blue packet — Tap or hold still to keep the seal. Hold and nudge it sideways to break it.";

declare global {
  interface Window {
    __game?: {
      getSnapshot?: () => { scene?: { ready?: boolean; beat?: string } };
    };
  }
}

async function reachPacketOffered(page: Page, tag: string) {
  const slot = `packet-button-${tag}-${Date.now()}`;
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat),
      { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] },
    )
    .toBe("packet-offered");
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
  return packetButton;
}

// Real touch pointer sequence on #packetButton: press, hold `holdMs`,
// optionally nudge sideways `pullPx` halfway through, release. Same
// dispatch shape as helpers/packetGesture.ts, parameterised so the
// spec can play the stationary hold from #3061.
async function holdPacket(page: Page, holdMs: number, pullPx: number) {
  await page.evaluate(
    async ({ holdMs, pullPx }) => {
      const node = document.querySelector<HTMLElement>("#packetButton");
      if (!node) throw new Error("#packetButton not found");
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const pointer = (type: string, clientX: number, buttons: number) =>
        node.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 1,
            button: 0,
            buttons,
            pointerType: "touch",
            isPrimary: true,
            clientX,
            clientY: y,
          }),
        );
      pointer("pointerdown", x, 1);
      await new Promise((r) => setTimeout(r, Math.floor(holdMs / 2)));
      if (pullPx > 0) pointer("pointermove", x + pullPx, 1);
      await new Promise((r) => setTimeout(r, holdMs - Math.floor(holdMs / 2)));
      pointer("pointerup", x + pullPx, 0);
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
    { holdMs, pullPx },
  );
}

test.describe("AFTERSIGN packet button touch-target contract", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("#packetButton has a 44 CSS-pixel rendered touch target", async ({ page }) => {
    test.setTimeout(90_000);
    const packetButton = await reachPacketOffered(page, "touch-target");
    const box = await packetButton.boundingBox();

    expect(box, "packetButton must have a rendered hit area").not.toBeNull();
    expect(box!.width, "packetButton width must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);
    expect(box!.height, "packetButton height must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);
  });

  // #3061: a 1.5 s stationary hold kept the seal while the label implied a
  // hold breaks it. The label must say a still hold keeps the seal, and the
  // played outcome must match.
  test("a stationary 1.5 s hold keeps the seal, as the label says", async ({ page }) => {
    test.setTimeout(90_000);
    const packetButton = await reachPacketOffered(page, "still-hold");
    await expect(packetButton, "idle label must name both gestures").toHaveText(IDLE_TEXT);

    await holdPacket(page, 1500, 0);

    await expect(packetButton).toHaveAttribute("data-packet-button-copy-state", "sealed", {
      timeout: WAIT_MS,
    });
    await expect(packetButton).toContainText("Seal intact.");
  });

  test("a hold with a sideways nudge breaks the seal, as the label says", async ({ page }) => {
    test.setTimeout(90_000);
    const packetButton = await reachPacketOffered(page, "nudge-hold");
    await expect(packetButton, "idle label must name both gestures").toHaveText(IDLE_TEXT);

    await holdPacket(page, 900, 12);

    await expect(packetButton).toHaveAttribute("data-packet-button-copy-state", "opened", {
      timeout: WAIT_MS,
    });
    await expect(packetButton).toContainText("Seal broken.");
  });
});
