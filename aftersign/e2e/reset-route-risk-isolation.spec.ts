import { expect, test } from "@playwright/test";

// Regression: resetSliceSave must clear the route/risk memory axis.
// M-LOOP uses player.routeRisk as load-bearing progression input; if the
// reset surface leaves it behind, a fresh slice can inherit the prior run's
// divergent offered actions.

const WAIT_MS = 10_000;
const STORAGE_PREFIX = "aftersign:kiosk-slice:";

const RETURNING_ROUTE_RISK_SAVE = {
  beat: "packet-offered",
  packet: {
    delivered: true,
    route: "blue rainline",
    sealed: true,
    deliveredAt: "2026-01-01T00:00:00.000Z",
  },
  delivery: { outcome: "sealed" },
  player: {
    id: "reset-route-risk-player",
    name: null,
    flags: { io_intro_seen: true },
    routeRisk: { lastRoute: "fast", succeeded: true },
  },
  memory: [
    {
      id: "fact-delivery-outcome-reset-route-risk",
      kind: "delivery-outcome",
      subject: "io",
      object: "sealed",
      sessionId: "session-reset-route-risk",
    },
    {
      id: "fact-route-attention-reset-route-risk",
      kind: "route-attention",
      subject: "io",
      object: "done",
      sessionId: "session-reset-route-risk",
    },
  ],
  save: { revision: 1 },
};

test.describe("AFTERSIGN reset route-risk isolation", () => {
  test("resetting the served slice clears prior routeRisk before the fresh packet-offered render", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    const slot = `reset-route-risk-${Date.now()}`;
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      {
        key: `${STORAGE_PREFIX}${slot}`,
        value: JSON.stringify(RETURNING_ROUTE_RISK_SAVE),
      },
    );

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => window.__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__game?.getSnapshot?.().player?.routeRisk ?? null,
          ),
        { timeout: WAIT_MS },
      )
      .toEqual({ lastRoute: "fast", succeeded: true });

    await page.getByRole("button", { name: /reset/i }).tap();

    await expect(
      page.locator('[data-beat-id="packet-offered"]'),
      "reset should return the player to the fresh offered-packet beat",
    ).toBeVisible({ timeout: WAIT_MS });

    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__game?.getSnapshot?.().player?.routeRisk ?? null,
          ),
        {
          message:
            "resetSliceSave must clear the M-LOOP route/risk memory axis",
          timeout: WAIT_MS,
        },
      )
      .toBeNull();

    await expect(
      page.locator("#offeredJobs [data-mloop-memory-gate='fresh']").first(),
      "the reset render should expose fresh-gated offered actions, not inherited returning route risk",
    ).toBeVisible({ timeout: WAIT_MS });

    await context.close();
  });
});
