import { expect, test } from "@playwright/test";

// Regression contract for #2556: selecting an offered job must complete from
// a real mobile pointer tap, rather than through window.__game input hooks.
test.describe("AFTERSIGN offered-job touch contract", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a visible enabled signed-receipt offer receives a mobile pointer tap", async ({ page }) => {
    test.setTimeout(30_000);
    const playerId = `offer-touch-${Date.now()}`;
    const slot = `offer-touch-slot-${Date.now()}`;
    const payload = {
      beat: "packet-offered",
      packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
      delivery: { outcome: "unknown" },
      player: { id: playerId, name: null, flags: { io_intro_seen: true } },
      memory: [
        { id: "fact-delivery-outcome-seeded", kind: "delivery-outcome", subject: "io", object: "sealed", sessionId: "session-seeded" },
        { id: "fact-route-attention-seeded", kind: "route-attention", subject: "io", object: "done", sessionId: "session-seeded" },
      ],
      save: { revision: 1 },
    };
    const saveUrl = `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`;
    expect((await page.request.put(saveUrl, { data: { payload } })).ok()).toBe(true);

    await page.goto(`/aftersign/?slot=${slot}&player=${encodeURIComponent(playerId)}`);
    const offer = page.locator('[data-offered-job-id="job-signed-receipt"]');
    await expect(offer).toBeVisible();
    await expect(offer).toBeEnabled();
    await offer.tap();

    await expect(page.locator("#packetButton")).toHaveAttribute("data-packet-job", "signed-receipt");
  });
});
