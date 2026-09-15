import { expect, test } from "@playwright/test";

// A phone player needs a stable target long enough for a real touch to land.
// `main.js` renders job offers at packet-offered; this guard protects the
// signature-gated renderer from regressing into per-frame node replacement.
test.describe("AFTERSIGN phone job offer stability", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("the first offered job stays mounted across rendered frames and accepts a tap", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `job-offer-stability-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    const offer = page.locator('[data-aftersign-tap-choice="offer-job-safe-delivery"]');
    await expect(offer).toBeVisible({ timeout: 60_000 });
    await expect(offer).toBeEnabled();

    const initialHandle = await offer.elementHandle();
    expect(initialHandle, "a visible offer must have a concrete DOM node").not.toBeNull();

    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

    const settledHandle = await offer.elementHandle();
    expect(settledHandle, "the offer must remain mounted after render frames").not.toBeNull();
    expect(
      await initialHandle!.evaluate((node, later) => node === later, settledHandle),
      "the offered-job renderer must preserve the actionable node between frames",
    ).toBe(true);

    // The stability contract is that the offer node survives render frames
    // and accepts a real touch. The beat only advances on the subsequent
    // `#packetButton` tap (see `commitPacketOutcome` in `aftersign/main.js`);
    // asserting on `scene.beat` here would conflate two-step flow with
    // single-node stability. Keep this test focused on the stability gate.
    await offer.tap();
  });
});
