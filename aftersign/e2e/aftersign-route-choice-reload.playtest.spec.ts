import { expect, test, type Page, type Locator } from "@playwright/test";

// Playtest: #2326 (live-verify of #2322). The restore guard in
// `reloadFromSave` (aftersign/main.js:4040-4057) remaps a persisted
// `packet-delivered` beat to `packet-choice` when `packet.delivered`
// is false. That contradictory pair is the shape a LEGACY save (pre
// PR #2324) carries when the player was mid route-choice: the earlier
// build labelled the choice screen `packet-delivered` even though the
// packet had not yet been delivered. On reload, the "I ran early /
// I listened / Return to Io" post-delivery recognition fork would
// paint over a player who never delivered.
//
// Why this spec is shaped the way it is (Soren's PR #2327 REQUEST_CHANGES):
//   - In the CURRENT build, `deliverPacket` sets `packet.delivered=true`
//     BEFORE `setBeat("packet-delivered")` (main.js:4785/4803), so you
//     CANNOT reach the contradictory pair through player taps alone.
//     The bug only exists against OLD saves written by pre-fix code.
//   - Therefore, to exercise the guard, we must simulate a legacy save:
//     tap through to a legit `packet-choice`, then rewrite the server-
//     authoritative save payload to the legacy shape
//     (`beat="packet-delivered"` + `packet.delivered=false`) via the
//     same HTTP contract the game client uses
//     (`PUT /aftersign/save/:playerId/:slot`, see
//     aftersign/server-authoritative-save.js:78). This is NOT driving
//     input via `window.__game.input.*` — it's seeding a save as a
//     legacy client would have written one. `window.__game` is read
//     ONLY to pull `player.id` (an assertion surface, permitted by
//     `aftersignDurableStoryStateSaveLoadSurface.test.ts`).
//   - We do NOT assert `#skipRouteButton` hidden: the current build
//     renders it visible at `packet-choice` as the "I ran early" fork
//     label (main.js ~2988-2996). The symptom the fix addresses is the
//     BEAT ID flipping to `packet-delivered` on restore, not any button
//     visibility — so the assertion is `data-beat-id="packet-choice"`
//     after reload.
//
// Runtime premises validated against shipped code at session commit:
//   - Save key: `aftersign:kiosk-slice:${slot}` (main.js:1009); server
//     payload shape produced by `buildPersistPayload`
//     (aftersign/src/runtime/persistence.js:54-77) includes
//     `beat` + `packet` + `player` + `save` fields — we round-trip the
//     real payload and only overwrite the two offending fields so no
//     other schema invariant drifts.
//   - `hasTouch: true` is required for `.tap()` on the phone context.
//   - `data-beat-id` on the rendered line is the DOM contract asserted
//     by apps/web/src/aftersign/servedSurface.contract.test.ts.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

test.describe("AFTERSIGN route-choice reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test(
    "a legacy packet-delivered+undelivered save restores to packet-choice, not packet-delivered",
    async ({ page }) => {
      test.setTimeout(COLD_START_MS);

      const slot = `route-choice-reload-${Date.now()}`;
      await page.goto(`/aftersign/index.html?slot=${slot}`, {
        waitUntil: "load",
      });

      // --- Play from a fresh save up to the route-choice fork, by taps only,
      // so a well-formed save exists on the server.
      await waitForBeat(page, "packet-offered");
      const packet = page.locator("#packetButton");
      await expect(
        packet,
        "#packetButton should be visible at packet-offered",
      ).toBeVisible({ timeout: WAIT_MS });
      await packet.tap();
      await waitForBeat(page, "packet-choice");

      // --- Pull the server-authoritative save down, mutate it into the
      // LEGACY contradictory shape (the only shape the guard targets),
      // and PUT it back. This is the save a pre-#2324 client would have
      // written at this moment in the story.
      const mutation = await page.evaluate(async (slotKey) => {
        const game = (window as unknown as { __game?: { getSnapshot: () => { player: { id: string } } } }).__game;
        if (!game || typeof game.getSnapshot !== "function") {
          return { ok: false as const, reason: "window.__game.getSnapshot missing" };
        }
        const playerId = game.getSnapshot().player.id;
        const url = `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slotKey)}`;
        const getRes = await fetch(url, { method: "GET" });
        if (!getRes.ok) {
          return { ok: false as const, reason: `GET ${getRes.status}` };
        }
        const body = (await getRes.json()) as { payload?: Record<string, unknown>; exists?: boolean };
        if (!body?.payload || typeof body.payload !== "object") {
          return { ok: false as const, reason: "payload missing or non-object" };
        }
        const payload = body.payload as {
          beat?: string;
          packet?: { delivered?: boolean };
        };
        const beforeBeat = payload.beat;
        const beforeDelivered = payload.packet?.delivered;
        // Simulate a legacy save: contradictory pair.
        payload.beat = "packet-delivered";
        if (!payload.packet || typeof payload.packet !== "object") {
          payload.packet = { delivered: false };
        } else {
          payload.packet.delivered = false;
        }
        const putRes = await fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        if (!putRes.ok) {
          return { ok: false as const, reason: `PUT ${putRes.status}` };
        }
        return {
          ok: true as const,
          beforeBeat,
          beforeDelivered,
          seededBeat: payload.beat,
          seededDelivered: payload.packet.delivered,
        };
      }, slot);

      expect(mutation.ok, `legacy-save seeding should succeed: ${JSON.stringify(mutation)}`).toBe(true);
      if (mutation.ok) {
        expect(mutation.beforeBeat).toBe("packet-choice");
        expect(mutation.seededBeat).toBe("packet-delivered");
        expect(mutation.seededDelivered).toBe(false);
      }

      // --- Reload. Without the guard, `reloadFromSave` would restore
      // `scene.beat = "packet-delivered"` from the seeded save, and
      // the DOM would show that beat's post-delivery recognition fork.
      // With the guard at main.js:4040-4057, the contradictory pair is
      // remapped to `packet-choice` and the player sees their actual
      // unfinished route choice.
      await page.reload({ waitUntil: "load" });

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
        const game = (window as unknown as { __game?: { getSnapshot: () => { scene: { beat: string } } } }).__game;
        return game?.getSnapshot?.().scene?.beat ?? null;
      });
      expect(
        restoredBeat,
        "restored scene.beat should be packet-choice, not packet-delivered",
      ).toBe("packet-choice");
    },
  );
});
