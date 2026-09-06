import { expect, test } from "@playwright/test";

// Regression: resetSliceSave must clear the route/risk memory axis.
// M-LOOP uses player.routeRisk as load-bearing progression input; if the
// reset surface leaves it behind, a fresh slice can inherit the prior run's
// divergent offered actions.
//
// Seed vector — server-authoritative endpoint (PR #1636 / #1642).
//
// The served page no longer boots from `localStorage`. `aftersign/main.js`
// calls `readAuthoritativeSave({ slot, playerId: "local-slice-player" })`
// at boot; the response wins and the prior `readStored()` fallback is
// gone (PR #1642). Any seed MUST be PUT into the same authoritative
// store the served page will read:
//   PUT /aftersign/save/${BOOTSTRAP_PLAYER_ID}/${slot}
//   body: { payload: <persist payload shape> }
// (Endpoint owner: aftersign/vite.config.ts →
// aftersignAuthoritativeSaveMiddleware.)
//
// The bootstrap playerId is the fixed `"local-slice-player"` string
// hardcoded in `aftersign/main.js` around line 556 — it is NOT the
// `player.id` inside the seeded payload. Once the seed is loaded
// state.player.id becomes the payload's id, but the READ path uses
// the bootstrap constant, so the seed MUST be PUT under it.
//
// Sibling specs on the same migration:
//   - `memory-divergence-phone-playtest.spec.ts`
//   - `m-loop-divergent-offered-actions.playtest.spec.ts`

const WAIT_MS = 10_000;

// See boot in aftersign/main.js (~line 556): the read is always keyed
// on this fixed bootstrap id. Any seed must be PUT under it.
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

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

    // Seed the authoritative store BEFORE navigating. The served page
    // now reads exclusively from
    //   /aftersign/save/${BOOTSTRAP_PLAYER_ID}/${slot}
    // at boot (PR #1642 dropped the `readStored()` localStorage
    // fallback). Without this PUT the boot resolves null → cold
    // packet-offered with `player.routeRisk = null`, and the first
    // `toEqual({ lastRoute: "fast", succeeded: true })` assertion
    // fails before the reset button is even tapped.
    const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(
      BOOTSTRAP_PLAYER_ID,
    )}/${encodeURIComponent(slot)}`;
    const seedResponse = await page.request.put(saveUrl, {
      data: { payload: RETURNING_ROUTE_RISK_SAVE },
      headers: { "content-type": "application/json" },
    });
    expect(
      seedResponse.ok(),
      `seed PUT for slot ${slot} must succeed before page boot (HTTP ${seedResponse.status()})`,
    ).toBe(true);

    // Round-trip verify through the SAME endpoint the served page
    // boot will hit. If this GET returns the wrong payload (null /
    // stripped routeRisk / different id encoding), boot will
    // hydrate empty state and the first assertion fails with an
    // opaque `null !== { lastRoute: "fast", succeeded: true }`
    // instead of a named seed-step failure.
    const verifyResponse = await page.request.get(saveUrl, {
      headers: { accept: "application/json" },
    });
    expect(
      verifyResponse.ok(),
      `seed round-trip GET for slot ${slot} must succeed before page boot (HTTP ${verifyResponse.status()})`,
    ).toBe(true);
    const verifyBody = (await verifyResponse.json()) as {
      payload?: { player?: { routeRisk?: unknown } | null } | null;
    };
    expect(
      verifyBody?.payload,
      `seed round-trip GET for slot ${slot} must return the payload the served page will read at boot`,
    ).not.toBeNull();
    expect(
      verifyBody?.payload?.player?.routeRisk,
      `seed round-trip payload for slot ${slot} must carry the returning routeRisk the reset spec asserts on`,
    ).toEqual({ lastRoute: "fast", succeeded: true });

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
