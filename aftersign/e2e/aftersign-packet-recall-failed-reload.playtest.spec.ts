import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN failed-route recall — survives a hard reload at packet-choice.
//
// Why this isn't a "tap through then reload" spec (CI failure history):
//   An earlier draft tapped `#job-offer-job-safe-delivery` then
//   `#packetButton`, waited on a `PUT /aftersign/save/*` whose
//   `payload.beat === "packet-choice"` arrived, and only then reloaded.
//   That `waitForResponse` timed out on CI — see PR #2339's bot
//   comments. The reason is in the owning code, not in timing:
//
//     - `setBeat("packet-choice")` in `aftersign/main.js` only calls
//       `markStateDirty()` + `publishState()` + `renderText()`. It
//       does NOT call `persistAuthoritative`. There is no debounced
//       auto-save loop in `aftersign/src/runtime/persistence.js` —
//       `persistAuthoritative` fires only at explicit call sites
//       (`packet-delivered`, `io-return-recognition`, route-risk
//       choose, `io-next-job`). So no PUT with
//       `payload.beat === "packet-choice"` is ever emitted.
//     - Even if a PUT fired, reloading mid-tap races the write — the
//       failure mode the earlier draft documented.
//
//   The proven pattern lives in
//   `aftersign/e2e/aftersign-route-choice-reload.playtest.spec.ts`:
//   seed a save shape that `restoreFlagshipBeat`
//   (`aftersign/flagship-beat-migration.js`) demotes to
//   `packet-choice` at cold-boot hydration — then every reload lands
//   at `packet-choice` deterministically with no race on a save that
//   never fires.
//
// What this spec proves:
//   A durable save carrying BOTH (a) the contradictory
//   `beat="packet-delivered"` + `packet.delivered=false` pair that
//   `restoreFlagshipBeat` demotes to `packet-choice`, AND (b) a
//   failed prior route (`player.routeRisk.succeeded=false`) must
//   survive a real `page.reload()` — i.e. the restored
//   `packet-choice` beat renders the failed-memory `#routeRiskChoice`
//   tray with `repair-the-loss` visible and NOT the succeeded-safe
//   offers (`take-the-shortcut`, `carry-a-fragile-packet`). The
//   assertions run TWICE — once on first cold boot, once after a
//   real hard reload — so a regression that drops `routeRisk` from
//   the restored payload reds on the second pass before any
//   player-visible drift.
//
// Runtime premises read off shipped code at session commit (the
// final arbiter is a green CI run — iter history on this PR shows
// the header is cheap talk otherwise):
//   - `restoreFlagshipBeat({ savedBeat: "packet-delivered", packetDelivered: false })`
//     returns `"packet-choice"` (aftersign/flagship-beat-migration.js:40-45).
//   - Cold-boot hydration at `aftersign/main.js:1081-1089` invokes
//     `restoreFlagshipBeat` — reached by BOTH first `page.goto()` on
//     a slot with a seeded save AND by `page.reload()`.
//   - The DOM is only safe to query after `window.__game.scene.ready
//     === true` (same ready-gate the green sibling
//     `aftersign-packet-recall-failed-feel.playtest.spec.ts` uses).
//     Earlier iters of this spec skipped the gate and asserted on
//     `[data-beat-id="packet-choice"]` before cold-boot had painted
//     the restored beat — that's the red-CI failure Mara called out.
//   - Server payload shape produced by `buildPersistPayload`
//     (`aftersign/src/runtime/persistence.js`) carries top-level
//     `beat`, `packet`, `player`, `delivery`, `memory`, `npcs`,
//     `save`. The player `routeRisk` fact round-trips the server at
//     `/aftersign/save/:playerId/:slot`.
//   - `computeOfferedActions` (`routeRiskMemory.ts`) yields
//     `["repair-the-loss", "take-the-long-way"]` for any
//     `!memory.succeeded` fact; the sibling
//     `aftersign-packet-recall-failed-feel.playtest.spec.ts` proves
//     the resulting `#routeRiskChoice` DOM with the same seeded
//     routeRisk shape.
//   - `data-beat-id` on the rendered line is the DOM contract
//     asserted by `apps/web/src/aftersign/servedSurface.contract.test.ts`.
//   - `hasTouch: true` is required for `.tap()` on the phone context.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

async function waitForReady(page: Page): Promise<void> {
  // Same ready-gate the green sibling (failed-feel) uses. The DOM
  // isn't safe to query for `[data-beat-id]` until `scene.ready` is
  // true — before that, cold-boot restore has not yet called
  // `renderText()` and `[data-beat-id="packet-choice"]` is not
  // mounted. Skipping this gate is what reds the spec.
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

// Seed the authoritative save with:
//   - the contradictory `beat="packet-delivered"` + `packet.delivered=false`
//     pair that `restoreFlagshipBeat` demotes to `packet-choice` at
//     cold boot, AND
//   - a durable failed prior route (`routeRisk.succeeded=false`) so
//     `computeOfferedActions` lands on the recovery branch
//     (`repair-the-loss`) when the restored `packet-choice` renders
//     `#routeRiskChoice`.
//
// Payload shape mirrors `buildPersistPayload` in
// `aftersign/src/runtime/persistence.js`. One PUT, one navigation,
// one reload — no mutation of a server-written save, so there is no
// race with cold-boot's own authoritative writes.
async function seedFailedRouteContradictoryBeatSave(
  page: Page,
  slot: string,
): Promise<void> {
  const encodedPlayerId = encodeURIComponent(BOOTSTRAP_PLAYER_ID);
  const encodedSlot = encodeURIComponent(slot);
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodedPlayerId}/${encodedSlot}`;

  const payload = {
    beat: "packet-delivered",
    packet: {
      delivered: false,
      route: null,
      sealed: true,
      deliveredAt: null,
    },
    delivery: { outcome: "unknown" },
    player: {
      id: BOOTSTRAP_PLAYER_ID,
      name: null,
      flags: { io_intro_seen: true },
      // The axis under test: a durable failed-route memory.
      // `computeOfferedActions` returns
      // `["repair-the-loss", "take-the-long-way"]` for any
      // `!succeeded` fact (apps/web/src/aftersign/routeRiskMemory.ts).
      routeRisk: { lastRoute: "safe", succeeded: false },
    },
    memory: [],
    npcs: {
      orra: {
        memory: [],
        lastLine: null,
        lastLineId: null,
        lastLineMemoryRefs: [],
      },
    },
    save: { revision: 1 },
  };

  const putResponse = await page.request.put(saveUrl, {
    data: { payload },
    headers: { "content-type": "application/json" },
  });
  expect(
    putResponse.ok(),
    `seed PUT for slot ${slot} must succeed before page boot (HTTP ${putResponse.status()})`,
  ).toBe(true);

  // Round-trip verify BOTH axes survived the write — if the server
  // coerces either `beat` or `routeRisk.succeeded` before persistence
  // the restore guard / failed-memory branch is never exercised and
  // the spec would be tautological.
  const verifyResponse = await page.request.get(saveUrl, {
    headers: { accept: "application/json" },
  });
  expect(
    verifyResponse.ok(),
    `seed round-trip GET for slot ${slot} must succeed (HTTP ${verifyResponse.status()})`,
  ).toBe(true);
  const verifyBody = (await verifyResponse.json()) as {
    payload?: {
      beat?: string;
      packet?: { delivered?: boolean };
      player?: { routeRisk?: { succeeded?: boolean } };
    } | null;
  };
  expect(
    verifyBody.payload?.beat,
    `seed payload for slot ${slot} must carry beat="packet-delivered"`,
  ).toBe("packet-delivered");
  expect(
    verifyBody.payload?.packet?.delivered,
    `seed payload for slot ${slot} must carry packet.delivered=false`,
  ).toBe(false);
  expect(
    verifyBody.payload?.player?.routeRisk?.succeeded,
    `seed payload for slot ${slot} must carry routeRisk.succeeded=false`,
  ).toBe(false);
}

async function expectFailedRouteOfferTray(page: Page, phase: string): Promise<Locator> {
  await waitForBeat(page, "packet-choice");

  const tray = page.locator("#routeRiskChoice");
  await expect(tray, `${phase}: #routeRiskChoice should mount at restored packet-choice`).toBeVisible({
    timeout: WAIT_MS,
  });

  // Failed-memory branch: `repair-the-loss` is the recovery offer.
  const repairRoute = tray.locator(
    'button[data-aftersign-tap-choice="repair-the-loss"]:not([disabled])',
  );
  await expect(
    repairRoute,
    `${phase}: failed-route recovery offer must survive restore to packet-choice`,
  ).toBeVisible({ timeout: WAIT_MS });

  // Divergence pin: the succeeded-safe offers must NOT render on
  // the failed-memory branch. A refactor that drops `routeRisk` on
  // restore would fall back to the fresh/cold branch and surface
  // these — this assertion falsifies that drift.
  await expect(
    tray.locator('button[data-aftersign-tap-choice="take-the-shortcut"]'),
    `${phase}: succeeded-safe offer must not replace failed-route recovery after restore`,
  ).toHaveCount(0);
  await expect(
    tray.locator('button[data-aftersign-tap-choice="carry-a-fragile-packet"]'),
    `${phase}: succeeded-safe offer must not render on the failed-memory branch`,
  ).toHaveCount(0);

  return repairRoute;
}

test.describe("AFTERSIGN failed-route recall reload (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("failed-route repair offer remains after a hard reload in packet choice", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `packet-recall-failed-reload-${Date.now()}`;

    // Seed the durable save BEFORE navigation — the slot-scoped
    // authoritative endpoint is the same authority `aftersign/main.js`
    // reads at cold boot, so BOTH axes (the contradictory beat pair
    // AND the failed-route fact) reach `restoreFlagshipBeat` +
    // `state.player.routeRisk` on the FIRST render pass.
    await seedFailedRouteContradictoryBeatSave(page, slot);

    // Cold boot through the restore guard. First `page.goto()` on a
    // slot with an existing authoritative save goes through the same
    // cold-boot hydration path as `page.reload()` — the state literal
    // in `aftersign/main.js:1081-1089` calls `restoreFlagshipBeat`
    // with the stored `beat` and `packet.delivered`, demoting the
    // contradictory pair to `packet-choice`.
    await page.goto(`/aftersign/?slot=${slot}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    // (1) FIRST pass: cold-boot restore lands at packet-choice with
    // the failed-memory offer tray.
    await expectFailedRouteOfferTray(page, "cold boot");

    // (2) SECOND pass: a real `page.reload()` on the SAME slot must
    // also land at packet-choice with the SAME failed-memory offer
    // tray. The seeded save is still the contradictory pair (no tap
    // has yet re-persisted a canonical shape), so this proves the
    // guard + the failed-memory branch are idempotent across repeated
    // cold boots — the "survives a hard reload" contract.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    const repairRoute = await expectFailedRouteOfferTray(page, "after reload");

    // Visible-player-input proof. The played-input guard
    // (`playtest-input-surface-guard.spec.ts`) requires every
    // `*.playtest.spec.ts` to carry a real `.click/.tap/.press`. We
    // tap `repair-the-loss` on the RESTORED tray and wait for the
    // authoritative PUT that `renderRouteRiskChoice`'s `onChoose`
    // fires (`void persistAuthoritative({ dirty: true })` inside the
    // handler bound at `aftersign/main.js:2285-2311`). That PUT only
    // fires on a LIVE click handler — a frozen remount (DOM painted
    // by a stale last-render snapshot) would not emit it, so this is
    // the one assertion proving the restored `packet-choice` is a
    // live interactive beat, not just a static DOM.
    // Filter the save PUT on the specific `routeRisk.lastAction` the
    // tap writes — Mara's note on #2339: a boot-time PUT under
    // `/aftersign/save/` can race the real one and false-positive
    // this handshake. Matching on the tap-written field means only
    // the authoritative PUT fired by `repair-the-loss`'s onChoose
    // satisfies this wait; a stray boot write is ignored and the
    // test waits for the real one.
    const [savePutResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const request = response.request();
        if (request.method() !== "PUT") return false;
        if (
          !new URL(response.url()).pathname.startsWith(`${SAVE_ENDPOINT_BASE}/`)
        ) {
          return false;
        }
        const body = request.postDataJSON() as
          | {
              payload?: {
                player?: { routeRisk?: { lastAction?: string } };
              };
            }
          | null;
        return (
          body?.payload?.player?.routeRisk?.lastAction === "repair-the-loss"
        );
      }, { timeout: WAIT_MS }),
      repairRoute.tap(),
    ]);
    expect(
      savePutResponse.ok(),
      "repair-the-loss tap on a restored packet-choice must drive the authoritative save PUT",
    ).toBe(true);
    const savedPayload = (savePutResponse.request().postDataJSON() ?? {}) as {
      payload?: {
        beat?: string;
        player?: {
          routeRisk?: { succeeded?: boolean; lastAction?: string };
        };
      };
    };
    expect(
      savedPayload.payload?.player?.routeRisk?.lastAction,
      "the tap must have written repair-the-loss into the durable routeRisk fact",
    ).toBe("repair-the-loss");
    expect(
      savedPayload.payload?.player?.routeRisk?.succeeded,
      "repair-the-loss keeps the memory on the failed-recovery axis (succeeded=false)",
    ).toBe(false);
  });
});
