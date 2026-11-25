import { expect, test, type Page } from "@playwright/test";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// #3046 — blind playtest: after Start fresh, the route tray still showed
// "Cut past the bell rope" as the chosen route and the "I listened" choice
// still looked selected. Earlier attempts asserted `__game` STATE (routeRisk,
// packet.delivered), which reset does clear. The leak is in the DOM: the
// module-level `routeMemoryConfirmation` receipt (aftersign/main.js, set by
// the route-risk tap and re-stamped by a MutationObserver on every tray
// rebuild) and the inline `aria-pressed` / `data-aftersign-selected` stamp
// the acknowledge/skip tap writes on the reused route buttons. Neither was
// cleared by `resetSliceSave`. This spec plays the path with visible taps
// at 390×844 and asserts the DOM the player sees after the reset.

const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function reachPacketChoice(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const jobOffer = page.locator("#job-offer-job-safe-delivery");
  if (await jobOffer.isVisible().catch(() => false)) {
    await jobOffer.tap();
  }
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
  await packetButton.tap();
  await waitForBeat(page, "packet-choice");
}

test.describe("AFTERSIGN Start fresh clears visible route selections (#3046)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("after Start fresh the route tray shows no prior route receipt and no route button is pressed", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `reset-route-dom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await reachPacketChoice(page);

    // Prior run, in the order the playtest tapped: I listened, Lit stair,
    // then Cut past the bell rope once the tray's commit lock has passed.
    const acknowledge = page.locator("#acknowledgeRouteButton");
    await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
    await acknowledge.tap();
    await expect(acknowledge).toHaveAttribute("aria-pressed", "true", { timeout: WAIT_MS });

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const litStair = tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])');
    await expect(litStair).toBeVisible({ timeout: WAIT_MS });
    await litStair.tap();
    const unlockAfter = await page.evaluate((lockMs) => Date.now() + lockMs, ROUTE_RISK_CHOICE_LOCK_MS);
    await page.waitForFunction((deadline) => Date.now() >= deadline, unlockAfter, { timeout: WAIT_MS });
    const shortcut = tray.locator('button[data-aftersign-tap-choice="take-the-shortcut"]:not([disabled])');
    await expect(shortcut).toBeVisible({ timeout: WAIT_MS });
    await shortcut.tap();
    await expect(tray.locator("[data-aftersign-route-memory-confirmation]")).toHaveCount(1, {
      timeout: WAIT_MS,
    });

    // Start fresh (two-tap confirm).
    const reset = page.locator("#resetButton");
    await reset.tap();
    await expect(reset).toHaveText("Confirm start fresh");
    await reset.tap();
    await expect(reset).toHaveText("Start fresh", { timeout: WAIT_MS });

    // Fresh run: walk back to the route tray the player saw.
    await reachPacketChoice(page);
    await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });

    await expect(
      tray.locator("[data-aftersign-route-memory-confirmation]"),
      "a fresh run must not show the previous run's route receipt",
    ).toHaveCount(0);
    expect(await tray.getAttribute("data-aftersign-selected-action")).toBeNull();
    expect(await tray.getAttribute("data-route-memory-confirmation")).toBeNull();
    for (const id of ["#acknowledgeRouteButton", "#skipRouteButton"]) {
      const button = page.locator(id);
      await expect(button, `${id} must not look selected on a fresh run`).not.toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(await button.getAttribute("data-aftersign-selected")).toBeNull();
    }
  });
});
