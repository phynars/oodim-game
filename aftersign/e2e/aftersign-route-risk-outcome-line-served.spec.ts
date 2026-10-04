import { expect, test, type Page } from "@playwright/test";
import { aftersignRouteOutcomeLine } from "../../apps/web/src/aftersign/aftersignRouteOutcomeCopy.js";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// AFTERSIGN #1963 — route-outcome line rendered on the served page.
//
// These mobile, tap-driven checks prove the line at `packet-delivered`
// acknowledges the route the player actually took, rather than only a
// preloaded snapshot fact.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const SAFE_OUTCOME_LINE = aftersignRouteOutcomeLine("safe") ?? "";
if (!SAFE_OUTCOME_LINE) {
  throw new Error("aftersignRouteOutcomeLine('safe') returned null — the copy module lost its SAFE entry; fix the copy, don't skip the spec.");
}
const FRESH_DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";

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

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice, `choice "${choiceId}" should be visible and tappable`).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function reachPacketChoiceFresh(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const jobOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(jobOffer).toBeVisible({ timeout: WAIT_MS });
  await jobOffer.tap();
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
  await packetButton.tap();
  await waitForBeat(page, "packet-choice");
}

async function deliverFromRouteChoice(page: Page): Promise<void> {
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
}

async function snapshotRouteRisk(page: Page): Promise<{ lastRoute?: string; succeeded?: boolean } | null> {
  return page.evaluate(
    () =>
      (window as unknown as {
        __game?: { getSnapshot: () => { player?: { routeRisk?: { lastRoute?: string; succeeded?: boolean } | null } } };
      }).__game?.getSnapshot().player?.routeRisk ?? null,
  );
}

async function snapshotIoLine(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as unknown as {
        __game?: { getSnapshot: () => { npcs: { io: { lastLine?: string | null } } } };
      }).__game?.getSnapshot().npcs.io.lastLine ?? null,
  );
}

test.describe("AFTERSIGN packet-delivered route-outcome line (#1963)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("tapping the SAFE route action speaks the authored SAFE outcome line at packet-delivered", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `route-outcome-safe-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await reachPacketChoiceFresh(page);

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const safeRouteButton = tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])');
    await expect(safeRouteButton).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();
    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({ lastRoute: "safe", succeeded: true, lastAction: "take-the-long-way" });

    await deliverFromRouteChoice(page);
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(line).toHaveText(SAFE_OUTCOME_LINE, { timeout: WAIT_MS });
    expect((await line.textContent()) ?? "").not.toBe(FRESH_DELIVERED_LINE);
    expect(await snapshotIoLine(page)).toBe(SAFE_OUTCOME_LINE);
  });

  test("tapping the FAST route action speaks the authored FAST outcome line at packet-delivered", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const fastOutcomeLine = aftersignRouteOutcomeLine("fast");
    expect(fastOutcomeLine, "FAST route must have authored outcome copy").not.toBeNull();

    const slot = `route-outcome-fast-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    expect(await snapshotRouteRisk(page)).toBeNull();
    await reachPacketChoiceFresh(page);

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const safeRouteButton = tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])');
    await expect(safeRouteButton).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();
    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({ lastRoute: "safe", succeeded: true, lastAction: "take-the-long-way" });
    await waitForBeat(page, "packet-choice");

    const unlockAfter = await page.evaluate((lockMs) => Date.now() + lockMs, ROUTE_RISK_CHOICE_LOCK_MS);
    await page.waitForFunction((deadline) => Date.now() >= deadline, unlockAfter, { timeout: WAIT_MS });
    const fastRouteButton = tray.locator('button[data-aftersign-tap-choice="take-the-shortcut"]:not([disabled])');
    await expect(fastRouteButton).toBeVisible({ timeout: WAIT_MS });
    await fastRouteButton.tap();
    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({ lastRoute: "fast", succeeded: true, lastAction: "take-the-shortcut" });

    await deliverFromRouteChoice(page);
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(line).toHaveText(fastOutcomeLine!, { timeout: WAIT_MS });
    expect(await line.textContent()).toBe(fastOutcomeLine);
    expect(await snapshotIoLine(page)).toBe(fastOutcomeLine);
  });
});
