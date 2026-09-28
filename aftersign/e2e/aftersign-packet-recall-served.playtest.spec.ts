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
// `aftersign/main.js` stamps in response to a `#line` mutation. The
// only harness surface we touch is `state.player.routeRisk` (a
// runtime seam any save-restore path also writes) to represent the
// "player has a prior run" fixture — the reader that stamps the
// sibling paragraph is the served renderer, not the test.
//
// CONSUMER (Soren PR #2008 re-review). Blocks the prior "top-of-
// module import with zero readers" pattern: the observer installed
// in `aftersign/main.js` reads `#line` mutations and stamps the
// recall paragraph off `state.player.routeRisk`. If a future
// refactor drops the observer / reverts to the pure-globalThis
// seam, THIS spec reds because `#packetRecallLine` never appears
// on the served page.

import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 15_000;

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

// Seed `state.player.routeRisk` and force a `#line` mutation so the
// served observer fires and stamps the sibling paragraph. This is
// the play-time equivalent of a returning-player save-restore that
// lands on `packet-offered` with the durable memory already present.
//
// PLAYED-NOT-DRIVEN (Soren re-review #2008). We deliberately do NOT
// call `__aftersignPacketRecall.sync()` here — that diagnostic seam
// would let this spec green even if the served MutationObserver on
// `#line` were removed. Instead we mutate `#line.textContent` (the
// exact signal the shipped observer listens for), so the trip-wire
// is the observer install itself: break it and this spec reds.
async function seedRouteRiskAndSync(
  page: Page,
  memory: { lastRoute: "safe" | "fast"; succeeded: boolean } | null,
): Promise<void> {
  await page.evaluate((mem) => {
    const g = window as unknown as {
      __game?: {
        state?: { player?: { routeRisk?: unknown } };
        scene?: { beat?: string };
      };
    };
    if (!g.__game) throw new Error("window.__game not present");
    if (!g.__game.state) throw new Error("window.__game.state not present");
    if (!g.__game.state.player) g.__game.state.player = {};
    g.__game.state.player.routeRisk = mem;

    // Fire the served observer by mutating `#line`. Rewriting
    // `textContent` to a distinct value (then restoring) guarantees a
    // MutationObserver characterData/childList tick without leaving
    // the beat dialogue in a wrong state. The observer reads
    // `state.player.routeRisk` off `window.__game.state` — the same
    // seam a durable save-restore writes — and stamps
    // `#packetRecallLine`.
    const lineEl = document.getElementById("line");
    if (!lineEl) throw new Error("#line not present on served page");
    const original = lineEl.textContent ?? "";
    // Force a real mutation (empty then original) so the observer
    // fires even if `textContent` was already equal to `original`.
    lineEl.textContent = "";
    lineEl.textContent = original;
  }, memory);
}

test.describe("AFTERSIGN packet-recall sibling line (played)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("fresh first visit does NOT render #packetRecallLine at packet-offered", async ({
    page,
  }) => {
    const slot = `packet-recall-fresh-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // First visit → no durable routeRisk memory → no recall paragraph.
    // The base beat dialogue still owns `#line`; only the sibling
    // recall paragraph is gated on the memory being restored.
    await expect(
      page.locator("#packetRecallLine"),
      "recall paragraph must not appear on a fresh boot with no prior route memory",
    ).toHaveCount(0);
  });

  test("returning player with a successful safe run renders the safe recall line at packet-offered", async ({
    page,
  }) => {
    const slot = `packet-recall-safe-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // Fixture: represent a returning player by seeding the durable
    // route memory. The observer that STAMPS the sibling paragraph
    // is the served renderer, not the test — this seam only
    // stands in for a save-restore lane.
    await seedRouteRiskAndSync(page, {
      lastRoute: "safe",
      succeeded: true,
    });

    // RENDER PROOF — the served renderer's mutation-driven consumer
    // reads the seeded `state.player.routeRisk` and stamps the
    // sibling `#packetRecallLine` with the "safe" token's authored
    // copy. If the observer / read path regresses, the locator
    // disappears and this expectation reds first.
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
    // route-outcome axis Io speaks on
    // (`aftersignRouteOutcomeCopy.js` and the durable routeRisk
    // memory share this vocabulary; a translation-layer regression
    // would flip the attribute to a stale token and red here).
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
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await seedRouteRiskAndSync(page, {
      lastRoute: "fast",
      succeeded: false,
    });

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
