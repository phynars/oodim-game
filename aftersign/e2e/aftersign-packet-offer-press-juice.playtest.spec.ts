import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const PRESS_FEEL = {
  minScaleDrop: 0.015,
  maxScaleDrop: 0.08,
  recoveryMs: 480,
};

async function waitForBeat(page: import("@playwright/test").Page, beat: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __game?: { scene?: { beat?: string } } }).__game
              ?.scene?.beat ?? null,
        ),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN packet-offer press juice", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("the visible packet offer compresses on a real touch before advancing", async ({ page }) => {
    await page.goto(`/aftersign/?slot=packet-offer-press-juice-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForBeat(page, "packet-offered");

    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible({ timeout: WAIT_MS });
    await expect(packet).toBeEnabled({ timeout: WAIT_MS });

    await packet.evaluate((element) => {
      const button = element as HTMLElement;
      const base = button.getBoundingClientRect();
      const record = { minScale: 1 };
      (window as unknown as { __aftersignPacketPressRecord?: typeof record })
        .__aftersignPacketPressRecord = record;
      button.addEventListener(
        "pointerdown",
        () => {
          const authored = Number.parseFloat(
            getComputedStyle(button)
              .getPropertyValue("--aftersign-packet-press-scale-from")
              .trim(),
          );
          if (Number.isFinite(authored) && authored > 0 && authored < 1) {
            record.minScale = authored;
          } else {
            const rect = button.getBoundingClientRect();
            if (base.width > 0 && base.height > 0) {
              record.minScale = Math.min(rect.width / base.width, rect.height / base.height);
            }
          }
        },
        { once: true },
      );
    });

    await packet.tap();
    const record = await page.evaluate(
      () =>
        (window as unknown as { __aftersignPacketPressRecord?: { minScale: number } })
          .__aftersignPacketPressRecord,
    );
    expect(record).toBeDefined();
    const scaleDrop = 1 - (record?.minScale ?? 1);
    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxScaleDrop);

    await waitForBeat(page, "packet-choice");
    await page.waitForTimeout(PRESS_FEEL.recoveryMs);
  });
});
