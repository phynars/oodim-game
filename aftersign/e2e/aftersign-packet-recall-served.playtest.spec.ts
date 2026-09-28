import { expect, test, type Page } from "@playwright/test";

// PR #2008 re-review (Soren Vask) — packet-recall played e2e.
//
// SCOPE. This spec is the PLAYED-NOT-DRIVEN trip-wire for the
// packet-recall sibling line the served `aftersign/main.js` stamps at
// `packet-offered` when a returning player has a durable
// `state.player.routeRisk` restored from a prior run. If a designer
// rewords the recall copy in `aftersignPacketRecallCopy.js`, this
// spec follows automatically; if the wire that syncs
// `stampPacketRecallLine(document, previousRouteOutcome, line)` off
// `state.player.routeRisk` in `aftersign/main.js` breaks, the
// `#packetRecallLine` locator disappears and this spec reds.
//
// PLAYED, NOT DRIVEN (BRIEF 2026-08-15). Every locator assertion is
// against a real DOM node on the served page — `#packetRecallLine`
// is the SHIPPED sibling paragraph the observer in
// `aftersign/main.js` stamps in response to a `#line` mutation. We
// represent "the player has a prior run" the SAME way every other
// M-LOOP played spec does (see `reset-route-risk-isolation.spec.ts`
// / `m-loop-divergent-offered-actions.playtest.spec.ts`): by PUT-
// seeding the authoritative save endpoint BEFORE navigation so the
// served page boots with `state.player.routeRisk` already restored
// through its own durable-restore lane. We do NOT touch
// `window.__game.state` (which the served page does not expose as
// a mutable surface — only `getSnapshot()` is read-only) and we do
// NOT call any test-only seam. The reader that stamps the sibling
// paragraph is the served renderer, not the test.
//
// CONSUMER (Soren PR #2008 re-review). The observer installed in
// `aftersign/main.js` reads `#line` mutations and stamps the recall
// paragraph off `state.player.routeRisk`. If a future refactor
// drops the observer / reverts to the pure-globalThis seam, THIS
// spec reds because `#packetRecallLine` never appears on the served
// page.

import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 15_000;

// The served page boot in `aftersign/main.js` reads the authoritative
// save under this fixed bootstrap playerId (see the sibling seed
// specs: `reset-route-risk-isolation.spec.ts:34`,
// `m-loop-divergent-offered-actions.playtest.spec.ts`). Any seed
// MUST be PUT under this id — the payload's `player.id` becomes the
// runtime state only AFTER the read succeeds against the bootstrap
// slot key.
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type SeededRouteRisk = { lastRoute: "fast" | "safe"; succeeded: boolean };

function buildSeedPayload(routeRisk: SeededRouteRisk) {
  return {
    beat: "packet-offered",
    packet: {
      delivered: true,
      route: routeRisk.lastRoute === "fast" ? "black shortline" : "blue rainline",
      sealed: routeRisk.succeeded,
      deliveredAt: "2026-01-01T00:00:00.000Z",
    },
    delivery: { outcome: routeRisk.succeeded ? "sealed" : "opened" },
    player: {
      id: "packet-recall-returning-player",
      name: null,
      flags: { io_intro_seen: true },
      routeRisk,
    },
    memory: [
      {
        id: "fact-delivery-outcome-packet-recall",
        kind: "delivery-outcome",
        subject: "io",
        object: routeRisk.succeeded ? "sealed" : "opened",
        sessionId: "session-packet-recall",
      },
    ],
    save: { revision: 1 },
  };
}

async function seedAuthoritativeSave(
  page: Page,
  slot: string,
  routeRisk: SeededRouteRisk,
): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(
    BOOTSTRAP_PLAYER_ID,
  )}/${encodeURIComponent(slot)}`;
  const seedResponse = await page.request.put(saveUrl, {
    data: { payload: buildSeedPayload(routeRisk) },
    headers: { "content-type": "application/json" },
  });
  expect(
    seedResponse.ok(),
    `seed PUT for slot ${slot} must succeed before page boot (HTTP ${seedResponse.status()})`,
  ).toBe(true);

  // Round-trip verify through the same endpoint the served page will
  // read at boot — if this returns null / stripped routeRisk, the
  // downstream `#packetRecallLine` assertion would fail with an
  // opaque "locator not visible" instead of a named seed-step failure.
  const verifyResponse = await page.request.get(saveUrl, {
    headers: { accept: "application/json" },
  });
  expect(
    verifyResponse.ok(),
    `seed round-trip GET for slot ${slot} must succeed (HTTP ${verifyResponse.status()})`,
  ).toBe(true);
  const verifyBody = (await verifyResponse.json()) as {
    payload?: { player?: { routeRisk?: unknown } | null } | null;
  };
  expect(
    verifyBody?.payload?.player?.routeRisk,
    `seed round-trip payload for slot ${slot} must carry routeRisk the recall spec asserts on`,
  ).toEqual(routeRisk);
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

// Sanity-check the durable restore landed the seed on `state.player`.
// Read-only surface — `getSnapshot()` is the served page's public
// read handle (see `aftersignDurableStoryStateSaveLoadSurface.test.ts`
// and `reset-route-risk-isolation.spec.ts:139` for the exact call).
async function waitForRestoredRouteRisk(
  page: Page,
  expected: SeededRouteRisk,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window as unknown as {
            __game?: {
              getSnapshot?: () => { player?: { routeRisk?: unknown } | null };
            };
          };
          return g.__game?.getSnapshot?.().player?.routeRisk ?? null;
        }),
      { timeout: WAIT_MS },
    )
    .toEqual(expected);
}

test.describe("AFTERSIGN packet-recall sibling line (played)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("fresh first visit does NOT render #packetRecallLine at packet-offered", async ({
    page,
  }) => {
    const slot = `packet-recall-fresh-${Date.now()}`;
    // No PUT-seed → cold boot → no durable routeRisk memory → no
    // recall paragraph. The base beat dialogue still owns `#line`;
    // only the sibling recall paragraph is gated on the memory
    // being restored.
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await expect(
      page.locator("#packetRecallLine"),
      "recall paragraph must not appear on a fresh boot with no prior route memory",
    ).toHaveCount(0);
  });

  test("returning player with a successful safe run renders the safe recall line at packet-offered", async ({
    page,
  }) => {
    const slot = `packet-recall-safe-${Date.now()}`;
    const routeRisk: SeededRouteRisk = { lastRoute: "safe", succeeded: true };

    // Seed the authoritative save BEFORE navigation so the served
    // page's boot restore populates `state.player.routeRisk` through
    // its own durable-restore lane — the same lane a real returning
    // player traverses. The observer on `#line` in `aftersign/main.js`
    // then stamps `#packetRecallLine` off that restored memory when
    // the beat dialogue renders.
    await seedAuthoritativeSave(page, slot, routeRisk);

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForRestoredRouteRisk(page, routeRisk);
    await waitForBeat(page, "packet-offered");

    // RENDER PROOF — the served renderer's mutation-driven consumer
    // reads the restored `state.player.routeRisk` and stamps the
    // sibling `#packetRecallLine` with the "safe" token's authored
    // copy (`{lastRoute: safe, succeeded: true}` → `"safe"`). If the
    // observer / read path regresses, the locator disappears and
    // this expectation reds first.
    const expectedLine = aftersignPacketRecallLine("safe");
    if (typeof expectedLine !== "string") {
      throw new Error(
        "aftersignPacketRecallLine('safe') must return a string — the copy table regressed",
      );
    }

    await expect(
      page.locator("#packetRecallLine"),
      "recall paragraph must render for a returning player with a successful safe run",
    ).toBeVisible({ timeout: WAIT_MS });

    await expect(page.locator("#packetRecallLine")).toHaveText(expectedLine, {
      timeout: WAIT_MS,
    });

    // TOKEN-AXIS PROOF — the sibling paragraph carries the exact
    // route-outcome axis Io speaks on (`aftersignRouteOutcomeCopy.js`
    // + the durable routeRisk memory share this vocabulary; a
    // translation-layer regression would flip the attribute to a
    // stale token and red here).
    await expect(page.locator("#packetRecallLine")).toHaveAttribute(
      "data-aftersign-packet-recall",
      "safe",
    );

    // `#line` is still owned by the beat dialogue table — the recall
    // is an ADDITIONAL sibling, never an overwrite. Same discipline
    // as `#jobTakeAckLine` (PR #1884).
    await expect(page.locator("#line")).not.toHaveText(expectedLine);
  });

  test("returning player with a failed run renders the failed recall line at packet-offered", async ({
    page,
  }) => {
    const slot = `packet-recall-failed-${Date.now()}`;
    const routeRisk: SeededRouteRisk = { lastRoute: "fast", succeeded: false };

    await seedAuthoritativeSave(page, slot, routeRisk);

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForRestoredRouteRisk(page, routeRisk);
    await waitForBeat(page, "packet-offered");

    // `{succeeded: false}` folds to the "failed" token regardless of
    // `lastRoute` — same axis the sibling `aftersignRouteOutcomeCopy.js`
    // speaks on.
    const expectedLine = aftersignPacketRecallLine("failed");
    if (typeof expectedLine !== "string") {
      throw new Error(
        "aftersignPacketRecallLine('failed') must return a string — the copy table regressed",
      );
    }

    await expect(
      page.locator("#packetRecallLine"),
      "recall paragraph must render for a returning player after a failed run",
    ).toBeVisible({ timeout: WAIT_MS });

    await expect(page.locator("#packetRecallLine")).toHaveText(expectedLine, {
      timeout: WAIT_MS,
    });

    await expect(page.locator("#packetRecallLine")).toHaveAttribute(
      "data-aftersign-packet-recall",
      "failed",
    );
  });
});
