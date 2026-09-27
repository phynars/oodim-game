import { expect, test, type Page } from "@playwright/test";
import { aftersignRouteOutcomeLine } from "../../apps/web/src/aftersign/aftersignRouteOutcomeCopy.js";

// AFTERSIGN #1963 — route-outcome line rendered on the served page.
//
// The wire under review adds a route-risk-aware branch to the
// `packet-delivered` line in `aftersign/main.js` (`lineForBeat`).
// When `state.player.routeRisk.succeeded === true` and
// `lastRoute === "safe"`, Io speaks the authored SAFE outcome line
// from `apps/web/src/aftersign/aftersignRouteOutcomeCopy.js` INSTEAD
// of the generic "clean handoff" line — a durable acknowledgement
// that the player ran the light-side route, not merely selected a
// job.
//
// Soren's review on the first two drafts blocked on the copy module
// existing in isolation with NO played-through e2e that taps a real
// route-risk button and asserts the shipped `#line` DOM node speaks
// the SAFE outcome literal. This spec is that proof — played, not
// driven:
//
//   1. Reach `packet-choice` through the shipped tap funnel
//      (`#job-offer-job-safe-delivery` → `#packetButton` → keep
//      sealed) so the route-risk tray is rendered against a real
//      served surface.
//   2. Tap the SAFE route action (`take-the-long-way`) inside the
//      `#routeRiskChoice` tray — the same button any player would
//      touch. This is the ONLY route into the `succeeded: true /
//      lastRoute: "safe"` fact from the offered-action set on a
//      fresh boot (see routeRiskMemory.ts::computeOfferedActions).
//   3. Acknowledge the kiosk + deliver the packet to advance the
//      beat to `packet-delivered` — the beat whose line the wire
//      diverts.
//   4. Assert `#line`.textContent is the SAFE outcome literal
//      verbatim (element-level, not snapshot-only), and is
//      distinctly NOT the fresh "clean handoff" line.
//
// A regression in the route-outcome wire (branch dropped, null
// return silently defaulted, wrong literal, or lookup keyed on the
// wrong axis) reds this spec on the exact surface the player reads.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

const SAFE_OUTCOME_LINE =
  "You kept to the light. It saw you home. I noted that.";
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
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

// Funnel the shipped surface from cold boot to `packet-choice`, where the
// route-risk tray is rendered and the SAFE / FAST route buttons are
// tappable. This is the same three-tap sequence a player would perform;
// extracting it lets the SAFE and FAST specs share the setup verbatim
// (a divergence here would silently mean the two forks are testing
// different pre-conditions).
async function reachPacketChoice(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#job-offer-job-safe-delivery").tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
}

// From the route-choice tray, advance the beat to `packet-delivered`
// through the shipped kiosk acknowledgement + delivery choices. Called
// AFTER the SAFE / FAST route action has been tapped and the routeRisk
// fact has been committed to the snapshot.
async function deliverFromRouteChoice(page: Page): Promise<void> {
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
}

async function snapshotRouteRisk(page: Page): Promise<{
  lastRoute?: string;
  succeeded?: boolean;
} | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __game?: {
            getSnapshot: () => {
              player?: {
                routeRisk?: { lastRoute?: string; succeeded?: boolean } | null;
              };
            };
          };
        }
      ).__game?.getSnapshot().player?.routeRisk ?? null,
  );
}

async function snapshotIoLine(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __game?: {
            getSnapshot: () => {
              npcs: { io: { lastLine?: string | null } };
            };
          };
        }
      ).__game?.getSnapshot().npcs.io.lastLine ?? null,
  );
}

test.describe("AFTERSIGN packet-delivered route-outcome line — safe fork (#1963)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("tapping the SAFE route action speaks the authored SAFE outcome line at packet-delivered", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `route-outcome-safe-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // 1. Funnel to packet-choice through the shipped tap surface.
    await reachPacketChoice(page);

    // 2. Tap the SAFE route action inside the route-risk tray. On a
    //    fresh boot (no prior routeRisk fact), computeOfferedActions
    //    returns `["repair-the-loss", "take-the-long-way"]`; the
    //    "take-the-long-way" action is the ONLY route into the
    //    `succeeded: true / lastRoute: "safe"` fact the delivered-
    //    line branch keys on.
    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray,
      "route-risk tray must be visible at packet-choice for the SAFE tap to land",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const safeRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(
      safeRouteButton,
      "the SAFE route action button must be a real tappable element",
    ).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();

    // Confirm the tap landed on a live handler — routeRisk fact
    // should now be recorded on the snapshot as
    // `{ lastRoute: "safe", succeeded: true }`. Without this, the
    // wire's branch guard `routeMemory && routeMemory.succeeded`
    // silently fails and we'd read the base line without the tap
    // ever having committed.
    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({
      lastRoute: "safe",
      succeeded: true,
    });

    // 3. Acknowledge the kiosk + deliver the packet.
    await deliverFromRouteChoice(page);

    // 4. Assert the shipped `#line` DOM node speaks the SAFE outcome
    //    literal verbatim, and is distinctly NOT the fresh
    //    "clean handoff" line. Element-level, not snapshot-only —
    //    a regression that only wires the snapshot (or writes a
    //    different id) reds here.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(
      line,
      "#line must speak the authored SAFE route-outcome line at packet-delivered",
    ).toHaveText(SAFE_OUTCOME_LINE, { timeout: WAIT_MS });
    const spokenText = (await line.textContent()) ?? "";
    expect(
      spokenText,
      "packet-delivered after a SAFE route tap must diverge from the fresh 'clean handoff' line",
    ).not.toBe(FRESH_DELIVERED_LINE);

    // Cross-check against the snapshot so a future refactor that
    // splits the DOM writer from `lineForBeat` cannot let the two
    // views drift silently.
    expect(
      await snapshotIoLine(page),
      "snapshot lastLine must match the DOM #line — one axis, no drift",
    ).toBe(SAFE_OUTCOME_LINE);
  });

  test("tapping the FAST route action speaks the authored FAST outcome line at packet-delivered", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const fastOutcomeLine = aftersignRouteOutcomeLine("fast");
    expect(fastOutcomeLine, "FAST route must have authored outcome copy").not.toBeNull();

    const slot = `route-outcome-fast-${Date.now()}`;

    // Seed the AUTHORITATIVE server-side save so the served page
    // cold-boots at `packet-offered` with a successful SAFE run
    // already on the ledger — that's the precondition for
    // `computeOfferedActions` to emit `take-the-shortcut` (per
    // routeRiskMemory.ts:102, FAST only renders after a prior
    // succeeded SAFE run).
    //
    // The served page reads from `/aftersign/save/${playerId}/${slot}`
    // at boot; localStorage seeding is a DEAD path since PR #1642
    // dropped the readStored() fallback. See reset-route-risk-isolation.spec.ts
    // for the canonical seed vector this test mirrors — same
    // BOOTSTRAP_PLAYER_ID, same PUT-then-round-trip-verify shape.
    //
    // Why seed instead of running two full deliveries: a two-run
    // funnel would duplicate the SAFE spec's assertions and add
    // ~30s of tap-latency to CI for zero additional signal on the
    // FAST outcome-line contract. Seeding isolates the FAST fork.
    const BOOTSTRAP_PLAYER_ID = "local-slice-player";
    const SAVE_ENDPOINT_BASE = "/aftersign/save";
    // Payload shape mirrors the canonical seed used by
    // `reset-route-risk-isolation.spec.ts` and
    // `m-loop-divergent-offered-actions.playtest.spec.ts` (the two
    // sibling specs on the PR #1642 authoritative-save migration
    // that currently ship green). Trimming this to `{beat, player,
    // memory:[], save}` reds CI: the boot hydration path in
    // `aftersign/main.js` expects `packet` + `delivery` alongside
    // `player` at the `packet-offered` beat, and a slimmed payload
    // fails to restore — the served page falls back to a fresh
    // cold boot with `player.routeRisk = null`, so
    // `computeOfferedActions(null)` returns
    // `["repair-the-loss","take-the-long-way"]`
    // (routeRiskMemory.ts:108) and `take-the-shortcut` is never
    // rendered. The verify-poll below would then time out — but
    // by then we've already burned the boot budget on nothing.
    //
    // Concretely, we need the pre-delivery packet-offered fixture:
    // `packet.delivered: false` + `delivery.outcome: "unknown"`
    // (see FRESH_SAVE in m-loop-divergent-offered-actions), plus
    // the prior-run `player.routeRisk = { lastRoute: "safe",
    // succeeded: true }` that's the actual precondition for
    // `take-the-shortcut` being offered.
    const SEED_SAVE = {
      beat: "packet-offered",
      packet: {
        delivered: false,
        route: null,
        sealed: true,
        deliveredAt: null,
      },
      delivery: { outcome: "unknown" },
      player: {
        id: "route-outcome-fast-seed-player",
        name: null,
        flags: { io_intro_seen: true },
        routeRisk: { lastRoute: "safe", succeeded: true },
      },
      memory: [],
      save: { revision: 1 },
    };
    const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(
      BOOTSTRAP_PLAYER_ID,
    )}/${encodeURIComponent(slot)}`;
    const seedResponse = await page.request.put(saveUrl, {
      data: { payload: SEED_SAVE },
      headers: { "content-type": "application/json" },
    });
    expect(
      seedResponse.ok(),
      `seed PUT for slot ${slot} must succeed before page boot (HTTP ${seedResponse.status()})`,
    ).toBe(true);

    // Round-trip verify through the SAME endpoint the served page
    // boot will hit. If this GET returns the wrong payload
    // (endpoint drift, id encoding mismatch, dropped routeRisk),
    // the downstream failure would be an opaque `null !==
    // { lastRoute: "safe", succeeded: true }` at the hydration
    // poll. This named check localizes the blame to the seed
    // step. Mirrors the canonical guard in
    // reset-route-risk-isolation.spec.ts.
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
      `seed round-trip payload for slot ${slot} must carry the prior-succeeded-SAFE routeRisk that gates take-the-shortcut`,
    ).toEqual({ lastRoute: "safe", succeeded: true });

    // Watch for boot-side hydration errors from `[aftersign boot]`
    // so a payload the server accepts but the client rejects fails
    // this test with a NAMED cause instead of a downstream
    // `toBeVisible` timeout on the shortcut button.
    const bootConsoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("[aftersign boot]")) {
        bootConsoleErrors.push(msg.text());
      }
    });

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    expect(
      bootConsoleErrors,
      `boot must not log an [aftersign boot] readAuthoritativeSave failure for slot ${slot} — a hydration reject means the shipped save shape drifted from this fixture`,
    ).toEqual([]);

    // Verify the seed hydrated — if the authoritative read didn't pick
    // up our PUT (endpoint drift, id encoding mismatch), the boot
    // falls back to null and take-the-shortcut is never rendered.
    // Fail here with a named message rather than downstream with an
    // opaque `toBeVisible` timeout.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "safe", succeeded: true });

    await reachPacketChoice(page);

    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray,
      "route-risk tray must be visible at packet-choice for the FAST tap to land",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const fastRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-shortcut"]:not([disabled])',
    );
    await expect(
      fastRouteButton,
      "the FAST route action button must be a real tappable element (requires a prior succeeded SAFE run seeded into the save)",
    ).toBeVisible({ timeout: WAIT_MS });
    await fastRouteButton.tap();

    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({
      lastRoute: "fast",
      succeeded: true,
    });

    await deliverFromRouteChoice(page);

    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(
      line,
      "#line must speak the authored FAST route-outcome line at packet-delivered",
    ).toHaveText(fastOutcomeLine!, { timeout: WAIT_MS });
    expect(
      await snapshotIoLine(page),
      "snapshot lastLine must match the FAST DOM #line — one axis, no drift",
    ).toBe(fastOutcomeLine);
  });
});
