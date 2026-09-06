import { expect, test, type Browser, type Page } from "@playwright/test";

// DURABLE SAVE/LOAD phone playtest. The harness is assertion-only: every
// player mutation below is a touch on a visible control.
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const RETURNING_SESSION_LINE = ioReturningSessionLines.sealedPacketSkippedRoute;

type FlagshipReadOnlySnapshot = {
  scene: { beat: string };
  packet: { delivered: boolean; sealed: boolean };
  delivery: { outcome: string };
  npcs: {
    io: {
      lastLine?: string | null;
      memory: Array<{ id?: string; object?: string; action?: string }>;
    };
  };
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

async function expectRestoredReturningSession(page: Page): Promise<void> {
  await waitForReady(page);
  await expect(page.locator("#line")).toBeVisible();
  await expect(page.locator("#line")).toHaveText(RETURNING_SESSION_LINE);

  const restored = await snapshot(page);
  expect(restored.scene.beat).toBe("packet-delivered");
  expect(restored.packet.delivered).toBe(true);
  expect(restored.packet.sealed).toBe(true);
  expect(restored.delivery.outcome).toBe("sealed");
  expect(restored.npcs.io.memory.length).toBeGreaterThan(0);
  expect(restored.npcs.io.memory.some((fact) => fact.object === "sealed")).toBe(true);
  expect(restored.npcs.io.lastLine).toBe(RETURNING_SESSION_LINE);
}

async function openFreshPhoneContext(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  // A new context has no origin storage. Assert that explicitly so recovery
  // below cannot be accidentally satisfied by the original browser cache.
  await page.goto("/aftersign/", { waitUntil: "load" });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.length), { timeout: WAIT_MS })
    .toBe(0);
  return page;
}

test.describe("AFTERSIGN durable save/load phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player recovers delivery facts and Io's returning-session line in a fresh browser context", async ({ browser, page }) => {
    // Two full WebGL boots + a real reload + a fresh-context boot exceed
    // Playwright's 30s default on shared runners. Extend the budget so the
    // cross-context leg isn't racing the timeout instead of the save/load
    // contract it's meant to prove.
    test.setTimeout(60_000);

    const slot = `durable-return-phone-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const url = `/aftersign/?slot=${slot}`;
    await page.goto(url, { waitUntil: "load" });
    await waitForReady(page);

    const boot = await snapshot(page);
    expect(boot.scene.beat).toBe("packet-offered");
    expect(boot.packet.delivered).toBe(false);
    expect(boot.npcs.io.memory.length).toBe(0);
    await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
    await expect(page.locator("#skipRouteButton")).toBeDisabled();

    // The only state-changing action is a player's tap on the rendered
    // delivery control. It causes the shipping backend save.
    await tap(page, "#deliverButton");
    await expect
      .poll(async () => (await snapshot(page)).packet.delivered, { timeout: WAIT_MS })
      .toBe(true);
    const delivered = await snapshot(page);
    expect(delivered.delivery.outcome).toBe("sealed");
    expect(delivered.npcs.io.memory.length).toBeGreaterThan(0);

    // Existing reload path: same context, a real document reload.
    await page.reload({ waitUntil: "load" });
    await expectRestoredReturningSession(page);

    // Cross-context path: no cookies or localStorage are carried over. The
    // same identified slot must therefore recover from the backend record,
    // not the browser-local save.
    const freshPage = await openFreshPhoneContext(browser);
    try {
      await freshPage.goto(url, { waitUntil: "load" });
      await expectRestoredReturningSession(freshPage);
    } finally {
      await freshPage.context().close();
    }
  });
});
