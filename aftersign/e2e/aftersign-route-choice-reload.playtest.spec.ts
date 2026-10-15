import { expect, test, type Page, type Locator } from "@playwright/test";

// Playtest: #2326 (live-verify of #2322). The restore guard —
// `restoreFlagshipBeat` in `aftersign/flagship-beat-migration.js` —
// remaps a persisted `packet-delivered` beat to `packet-choice` when
// `packet.delivered` is false. It is invoked at BOTH restore paths:
//   - cold-boot hydration (`aftersign/main.js:1079`-ish, inside the
//     `state` literal's `scene.beat`), which is what a real
//     `page.reload()` goes through, AND what a first `page.goto()`
//     with a pre-seeded authoritative save goes through;
//   - `reloadFromSave` (`aftersign/main.js:4040-...`), reached only
//     via the in-page `input.forceReload` surface.
// The contradictory pair is the shape a LEGACY save (pre PR #2324)
// carries when the player was mid route-choice: the earlier build
// labelled the choice screen `packet-delivered` even though the packet
// had not yet been delivered. On reload, the "I ran early / I listened
// / Return to Io" post-delivery recognition fork would paint over a
// player who never delivered.
//
// Seeding + input shape (PR #2327 iter-3):
//   - Prior iters tried GET-mutate-PUT after a tap into `packet-choice`,
//     which races cold-boot's own authoritative write. The sibling
//     `reset-route-risk-isolation.spec.ts` solves the same problem by
//     PUTTING a complete payload DIRECTLY against the slot-scoped
//     authoritative endpoint BEFORE navigation. We adopt that pattern:
//     one PUT, one navigation, one reload-equivalent cold boot through
//     the guard — no race, no mutation of a server-written save.
//   - Payload mirrors `buildPersistPayload` in
//     `aftersign/src/runtime/persistence.js`: top-level `beat`,
//     `packet`, `player`, `delivery`, `memory`, `npcs`, `save`. The two
//     fields that MUST be contradictory to exercise the guard are
//     `beat="packet-delivered"` + `packet.delivered=false`. All other
//     fields carry neutral defaults so no sibling invariant drifts.
//   - After the restore assertion, we tap the first visible button in
//     `#routeRiskChoice` (same shape driven by
//     `packet-choice-layout-and-route-memory-feedback.spec.ts`) and
//     then assert the `data-aftersign-route-memory-confirmation`
//     label echoes the choice name. Two reasons:
//       (a) `playtest-input-surface-guard.spec.ts` fails the whole
//           suite if a `*.playtest.spec.ts` file carries no real
//           `.click/.tap/.press`. That guard was the CI blocker on
//           this PR's prior pushes.
//       (b) It strengthens the regression — a restored DOM that
//           LOOKS like `packet-choice` but is a frozen remount would
//           not update the confirmation stamp on a tap.
//
// Runtime premises validated against shipped code at session commit:
//   - Server payload shape produced by `buildPersistPayload`
//     (aftersign/src/runtime/persistence.js) includes `beat` +
//     `packet` + `player` + `save` fields.
//   - Slot-scoped authoritative endpoint:
//     `PUT /aftersign/save/:playerId/:slot` (see
//     `aftersign/server-authoritative-save.js`) — the lane
//     `reset-route-risk-isolation.spec.ts` already uses to force a
//     divergent payload at cold boot.
//   - `hasTouch: true` is required for `.tap()` on the phone context.
//   - `data-beat-id` on the rendered line is the DOM contract asserted
//     by apps/web/src/aftersign/servedSurface.contract.test.ts.
//   - `#routeRiskChoice` + `[data-aftersign-route-memory-confirmation]`
//     are the stable DOM handles exercised by
//     `packet-choice-layout-and-route-memory-feedback.spec.ts`.
//
// Why we do NOT assert `#skipRouteButton` hidden: the current build
// renders it visible at `packet-choice` as the "I ran early" fork
// label. The symptom the fix addresses is the BEAT ID flipping to
// `packet-delivered` on restore, not any button visibility — so the
// assertion is `data-beat-id="packet-choice"` after cold boot.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

// Seed the authoritative save with the LEGACY contradictory pair:
// `beat="packet-delivered"` while `packet.delivered=false`. This is
// the one shape `restoreFlagshipBeat` targets, and the only shape a
// pre-#2324 client could have written at mid route-choice. We PUT the
// full payload up front — no GET, no mutation of a server-written
// save — so there is no race between cold-boot's authoritative write
// and the test's seed. Mirrors the sibling
// `reset-route-risk-isolation.spec.ts` seeding pattern.
async function seedLegacyPacketDeliveredSave(
  page: Page,
  slot: string,
): Promise<void> {
  const encodedPlayerId = encodeURIComponent(BOOTSTRAP_PLAYER_ID);
  const encodedSlot = encodeURIComponent(slot);
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodedPlayerId}/${encodedSlot}`;

  // Shape mirrors `buildPersistPayload` in
  // `aftersign/src/runtime/persistence.js`. The contradictory pair
  // (beat=packet-delivered + packet.delivered=false) is the sole thing
  // this spec is responsible for; everything else is a neutral default
  // chosen so no unrelated restore branch fires (e.g. empty memory,
  // no routeRisk fact).
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
      routeRisk: null,
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

  // Round-trip verify the contradictory pair survived the write — if
  // the server coerces `packet.delivered` or canonicalizes `beat`
  // before persistence, the fix path is never exercised and the spec
  // would be tautological.
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
}

test.describe("AFTERSIGN route-choice reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test(
    "a legacy packet-delivered+undelivered save restores to packet-choice, not packet-delivered",
    async ({ page }) => {
      test.setTimeout(COLD_START_MS);

      const slot = `route-choice-reload-${Date.now()}`;

      // Seed the contradictory legacy save BEFORE navigation — the
      // slot-scoped authoritative endpoint is the same authority
      // `aftersign/main.js` reads at cold boot, so the fact reaches
      // `restoreFlagshipBeat` on the FIRST render pass.
      await seedLegacyPacketDeliveredSave(page, slot);

      // Cold boot through the guard. A first `page.goto()` against a
      // slot with an existing authoritative save goes through the same
      // cold-boot hydration path as `page.reload()` — the `state`
      // literal in main.js:1079-ish calls `restoreFlagshipBeat` with
      // the stored `beat` and `packet.delivered`. Without the guard,
      // `scene.beat` would restore as `packet-delivered` and the DOM
      // would paint the post-delivery "I ran early / I listened" fork
      // over an undelivered player.
      await page.goto(`/aftersign/index.html?slot=${slot}`, {
        waitUntil: "load",
      });

      // The restored beat MUST be `packet-choice`. This is the single
      // assertion the fix is responsible for: if the guard is removed,
      // the next line fails because `data-beat-id` becomes
      // `packet-delivered`.
      await waitForBeat(page, "packet-choice");

      // Cross-check from the harness snapshot so the regression also
      // falsifies if the DOM happens to lag a frame behind the state —
      // see aftersignDurableStoryStateSaveLoadSurface.test.ts for the
      // read-only `getSnapshot()` contract.
      const restoredBeat = await page.evaluate(() => {
        const game = (
          window as unknown as {
            __game?: { getSnapshot: () => { scene: { beat: string } } };
          }
        ).__game;
        return game?.getSnapshot?.().scene?.beat ?? null;
      });
      expect(
        restoredBeat,
        "restored scene.beat should be packet-choice, not packet-delivered",
      ).toBe("packet-choice");

      // Second pass: a real `page.reload()` on the SAME slot must also
      // land at `packet-choice`. The seeded save is still the
      // contradictory pair (the client has not yet taken any choice
      // that would re-persist a canonical shape), so this proves the
      // guard is idempotent across repeated cold boots — i.e. the
      // player can refresh the tab mid route-choice without the DOM
      // ever flipping to the post-delivery fork.
      await page.reload({ waitUntil: "load" });
      await waitForBeat(page, "packet-choice");

      // Visible-player-input proof. The played-input guard
      // (`playtest-input-surface-guard.spec.ts`) requires every
      // `*.playtest.spec.ts` to carry a real `.click/.tap/.press`;
      // without one, the whole suite fails before our restore
      // assertions even run. We tap the first route-memory choice
      // inside `#routeRiskChoice` — same shape
      // `packet-choice-layout-and-route-memory-feedback.spec.ts`
      // drives — and then assert the
      // `data-aftersign-route-memory-confirmation` label echoes the
      // tapped choice name. That echo is the one assertion proving
      // the restored `packet-choice` is a LIVE interactive beat, not
      // a static DOM painted by a stale last-render snapshot: a
      // frozen remount wouldn't update the confirmation label.
      const routeChoice = page.locator("#routeRiskChoice");
      const firstRouteMemoryChoice = routeChoice.locator("button").first();
      await expect(
        firstRouteMemoryChoice,
        "restored packet-choice should expose a tappable route-memory choice button",
      ).toBeVisible({ timeout: WAIT_MS });
      const choiceName = (await firstRouteMemoryChoice.innerText()).trim();
      expect(
        choiceName.length,
        "route-memory choice button should carry a visible label before we tap it",
      ).toBeGreaterThan(0);
      await firstRouteMemoryChoice.click();
      await expect(
        routeChoice.locator("[data-aftersign-route-memory-confirmation]"),
        "tapping a route-memory choice on a restored packet-choice should surface its label in the confirmation stamp",
      ).toHaveText(choiceName, { timeout: WAIT_MS });
    },
  );
});
