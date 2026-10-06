import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;

// Fresh-slot kept-seal route-risk tray — the single live-visible slice of
// #2204 this PR covers. The player taps the visible job offer and
// `#packetButton`; the tray that renders at `packet-choice` must NOT
// offer `repair-the-loss` (no prior run exists on a fresh slot, so there
// is no loss to repair), but MUST still offer `take-the-long-way`
// (fresh-slot route choice legitimately includes the long way; see
// `aftersign-packet-recall-feel.playtest.spec.ts`, which taps it on a
// fresh slot).
//
// Scope: this spec is the served-page witness for the AI001 finding on
// PR #2206. It does not cover the other four live failures in #2204
// (Acknowledge/sound taps, Reset slice placement, Acknowledge/Skip
// labels) — those stay open as `Refs #2204` work in follow-up PRs.
test.describe("AFTERSIGN kept-seal route risk", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a kept seal offers a route, not recovery from a loss", async ({ page }) => {
    const slot = `kept-seal-route-risk-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    // The player reaches the route tray through the visible job offer and
    // packet controls; no harness input drives this outcome. The job
    // offer locator uses the stable `job-offer-*` id prefix the writer
    // stamps on every offered-job button.
    const jobOffer = page.locator('[id^="job-offer-"]').first();
    await expect(jobOffer, "a fresh slot presents at least one offered job").toBeVisible({
      timeout: WAIT_MS,
    });
    await jobOffer.tap();

    const packetButton = page.locator("#packetButton");
    await expect(packetButton, "accepting a job surfaces #packetButton").toBeVisible({
      timeout: WAIT_MS,
    });
    await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
    await packetButton.tap();

    // The route-risk tray renders at `packet-choice`. On a fresh slot
    // the memory is null, so `routeRiskMemoryForPacketChoice` must drop
    // `repair-the-loss` from the offered set.
    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toBeVisible({ timeout: WAIT_MS });
    await expect(
      tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]'),
      "a fresh-slot kept seal still offers the long-way route",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      tray.locator('button[data-aftersign-tap-choice="repair-the-loss"]'),
      "a kept seal with no prior run has no loss to repair",
    ).toHaveCount(0);
  });
});
