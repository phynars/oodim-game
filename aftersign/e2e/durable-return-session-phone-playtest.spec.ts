import { expect, test, type Page } from "@playwright/test";

// DURABLE SAVE/LOAD phone playtest — the green path for the
// `aftersignDurableSaveLoadPlaytestSurface` guard.
//
// SCOPE. Prove the AFTERSIGN vertical slice's M-WIRE/M-CONTINUE durable
// save/load contract from the player's chair, on a phone-shaped
// viewport, with REAL touch events — nothing driven through the
// harness input member on window.__game. The harness surface is used
// ONLY as an assertion mirror (read-only), never as an input.
//
// WHAT IT PLAYS.
//   1. Boot at `packet-offered` on a phone viewport. Only `#deliverButton`
//      is enabled at that beat (see `m-continue-phone-tap-playtest.spec.ts`
//      for the sibling proof that `#acknowledgeRouteButton` /
//      `#skipRouteButton` are inert until the packet is delivered).
//   2. TAP `#deliverButton`. `deliverPacket()` (aftersign/main.js) mints
//      the durable memory facts (packet outcome + route-attention) and
//      PERSISTS SYNCHRONOUSLY to localStorage before the auto-advance
//      timer to `io-return-recognition` fires. That save — the durable
//      one — is the state the reload restores.
//   3. `page.reload()` — a real browser reload, fresh module evaluation.
//      No harness force-reload shortcut, no scripted state jump. This
//      is the SAME shape a returning player produces by closing the tab
//      and coming back later.
//   4. On the second session, the #957 returning-session boot override
//      wins at the durable `packet-delivered` beat: `lineForBeat()`
//      speaks the RETURNING line minted by
//      `chooseIoReturningSessionLine({packetOutcome, routeAttention})`
//      — for this path (sealed default + secondAction=null normalized
//      to "skipped"), that's `sealedPacketSkippedRoute`. We assert the
//      visible `#line` copy matches the canonical returning-session
//      string, and we mirror-check the harness snapshot: durable
//      outcome=sealed, memory.length>0, remembered by the runtime.
//
// WHY THIS SATISFIES "played, not driven". Every mutation is a real
// touch event on a visible, enabled button — nothing calls the harness
// choose/forceSave/forceReload members. The reload is a real
// `page.reload()` (returning session, restored state, remembered
// facts). `window.__game` is read ONLY via `getSnapshot()` — a mirror
// of the DOM assertion, not a driver of it.
//
// Sibling context: `aftersign/e2e/flagship-reload-beat-regression.spec.ts`
// is the HARNESS-driven owner of the same contract (drives via the
// harness choose + forceSave + forceReload members). This file is
// the PLAYED counterpart — proving a phone player, using only visible
// affordances, actually restores their session and hears Io recognize
// them again.

import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

// Sealed + skipped-route is the path a player who taps ONLY
// `#deliverButton` from `packet-offered` produces:
//   • `packet.sealed` defaults to true (aftersign/main.js state init),
//   • `player.secondAction` stays null → `normalizeSecondAction(null)`
//     returns "skipped" at fact-mint (memoryFacts.js), so the durable
//     route-attention fact is "skipped".
// The returning-session line that pair mints on reload is the canonical
// `sealedPacketSkippedRoute` string (packages/aftersign/src/ioReturningSession.ts).
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
    // Read-only assertion surface. This spec deliberately does NOT
    // declare the harness input member here — driving state through
    // that member is banned in a played acceptance and the sibling
    // guard `aftersignDurableSaveLoadPlaytestSurface.test.ts` reds on
    // any file that references it.
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

test.describe("AFTERSIGN durable save/load phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player who delivers, closes the tab, and comes back sees Io's returning-session line restored from the persisted save", async ({ page }) => {
    // Unique slot per run so a parallel sibling can't leak a mid-story
    // save into our packet-offered boot (same pattern as
    // `m-continue-phone-tap-playtest.spec.ts`).
    const slot = `durable-return-phone-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST SESSION — fresh boot lands on `packet-offered`. The player
    // has ONE affordance: `#deliverButton`. Tapping it runs
    // `deliverPacket()` which PERSISTS the durable save (packet
    // outcome + route-attention memory facts) synchronously to
    // localStorage before any auto-advance timer fires. That is the
    // durable state a returning session will restore.
    const boot = await snapshot(page);
    expect(boot.scene.beat).toBe("packet-offered");
    expect(boot.packet.delivered).toBe(false);
    expect(boot.npcs.io.memory.length).toBe(0);

    await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
    await expect(page.locator("#skipRouteButton")).toBeDisabled();
    await tap(page, "#deliverButton");

    // Wait for delivery to persist + auto-advance. We don't assert
    // which beat we land on live (the ~1180ms setBeat race varies by
    // runner) — the durable contract asserts against the save, not
    // the live beat. The reload below is what proves durability.
    await expect
      .poll(async () => (await snapshot(page)).packet.delivered, {
        timeout: WAIT_MS,
      })
      .toBe(true);
    const delivered = await snapshot(page);
    expect(delivered.delivery.outcome).toBe("sealed");
    expect(delivered.npcs.io.memory.length).toBeGreaterThan(0);

    // SECOND SESSION — a real browser reload. Fresh module evaluation,
    // fresh JS heap, same localStorage. This is the shape a returning
    // player produces by closing the tab and coming back later; the
    // durable save is the ONLY thing that carries state across the gap.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);

    // RESTORED STATE — the durable outcome + memory facts are
    // remembered from the prior session, and Io speaks her
    // returning-session line (#957 boot override). The line lands in
    // the visible `#line` DOM node — that's the assertion the phone
    // player would actually see.
    await expect(page.locator("#line")).toBeVisible();
    await expect(page.locator("#line")).toHaveText(RETURNING_SESSION_LINE);

    // Harness snapshot mirrors the DOM assertion, read-only. Durable
    // save/load means: the previous session's delivery outcome + memory
    // facts survive a real reload, and the beat we boot into is the
    // saved `packet-delivered`.
    const restored = await snapshot(page);
    expect(restored.scene.beat).toBe("packet-delivered");
    expect(restored.packet.delivered).toBe(true);
    expect(restored.packet.sealed).toBe(true);
    expect(restored.delivery.outcome).toBe("sealed");
    expect(restored.npcs.io.memory.length).toBeGreaterThan(0);
    expect(
      restored.npcs.io.memory.some((fact) => fact.object === "sealed"),
    ).toBe(true);
    expect(restored.npcs.io.lastLine).toBe(RETURNING_SESSION_LINE);
  });
});
