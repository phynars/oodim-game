import { expect, test, type Browser, type Page } from "@playwright/test";

// #1907 visible-DOM-only cold-boot affordance spec.
//
// #2747 UPDATE: the shared `restoreFlagshipBeat` guard now promotes a
// delivered `packet-delivered` save to `io-return-recognition`, so the
// cold boot no longer stops on `packet-delivered` and the "Return to
// Io" tap is not needed. The spec below now pins that the racy seed
// save restores straight to the recognition beat + line. The history
// notes that follow describe the original #1907 premise.
//
// This spec proves the acceptance-criterion axis Mara filed on #1907:
// on a fresh browser context / cleared-storage restore of an identified
// slot that persisted at `scene.beat === "packet-delivered"`, a rendered,
// visible, enabled control exists that advances the beat to
// `io-return-recognition`, and tapping THAT VISIBLE CONTROL (not
// `window.__game.input.*`) lands the recognition line in `#line`.
//
// Sibling `flagship-reload-beat-regression.spec.ts` covers the same
// contract via the harness-driven `playSaveReloadPath` (which drives
// every fork through `window.__game.input.choose(...)`). This file is
// deliberately the OTHER shape: after the initial packet-choice fork
// (which must be committed via the harness because #packetOpenButton /
// #packetSealButton are the packet gesture, not the route fork we're
// pinning), every DRIVING step is a visible-DOM tap and every
// `window.__game.*` call is READ-ONLY (snapshot / boot-ready polling).
// The tap the affordance is proving — the one that turns
// `packet-delivered` into `io-return-recognition` on a cold-boot
// restore — is the visible `#deliverButton` labelled "Return to Io".
// If the affordance regresses (button hidden, disabled, mis-labelled,
// or wired to the wrong choice id) this spec reds.

import { dropDeliveryAutoAdvance } from "./helpers/deliveryTimer";
import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

const PHONE_VIEWPORT = { width: 390, height: 844 };

// Two full WebGL boots plus a real cross-context boot exceed
// Playwright's 30s default on shared runners under SwiftShader
// (#700 / #506 / #590 / #766). Sibling durable-return-session-phone-
// playtest.spec.ts pays the same cold-start tax and uses 180s; match
// that budget here so the fresh-context boot isn't racing the ceiling
// instead of the affordance contract it's meant to prove.
const COLD_BOOT_MS = 180_000;
const WAIT_MS = 60_000;

// Sealed-packet path: keep-sealed → deliver-packet (NO
// acknowledge-kiosk / skip-kiosk-acknowledge tap in between). Before
// #2326, the restored `packet-delivered` boot line read the normalized
// `SECOND_ACTION.SKIPPED` memory fact (null → SKIPPED default) and spoke
// `sealedPacketSkippedRoute` ("…ran before the route finished. Reliable
// hands, impatient feet.") — a false memory accusing a player who never
// tapped a route button. The served `armReturningSessionBootLine` gate
// now reads `state.player.secondAction` directly: null → undefined
// routeAttention → NEUTRAL `sealedPacket` line. The recognition line that
// the visible advance control must produce is the sealed-returning tier
// (the skipped-route axis still rides the
// `expectedIoRecognitionLine(…, false)` branch for the recognition
// selector, which continues to anchor on `routeListened === false` for
// the deep-recall gate).
const SEALED_DELIVERED_LINE = ioReturningSessionLines.sealedPacket;
const SEALED_RECOGNITION_LINE = expectedIoRecognitionLine("sealed", false);

type ColdBootSnapshot = {
  scene: { beat: string };
  packet: { delivered: boolean; sealed: boolean };
  delivery: { outcome: string };
  npcs: {
    io: {
      lastLine?: string | null;
      memory?: Array<{ id?: string; object?: string; action?: string }>;
      memories?: Array<{ id?: string; object?: string; action?: string }>;
    };
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => ColdBootSnapshot;
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

async function snapshot(page: Page): Promise<ColdBootSnapshot> {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function tap(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

async function openFreshPhoneContext(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  // A brand-new context: no cookies, no saved game in localStorage. Assert
  // the storage gap explicitly so a later restore cannot be satisfied by the
  // previous context's cached save. The one key allowed is the player id:
  // on the deployed Worker a first visit mints one per browser and keeps it
  // there (aftersign/src/playerIdentity.ts); it holds no game state.
  await page.goto("/aftersign/", { waitUntil: "load" });
  await expect
    .poll(
      () => page.evaluate(() => Object.keys(window.localStorage).filter((key) => key !== "aftersign:player-id:v1")),
      { timeout: WAIT_MS },
    )
    .toEqual([]);
  return page;
}

test.describe("AFTERSIGN packet-delivered cold-boot affordance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test(
    "cold-boot restore of a delivered packet-delivered save lands directly on io-return-recognition (#2747)",
    async ({ browser, page }) => {
      test.setTimeout(COLD_BOOT_MS);

      const slot = `packet-delivered-cold-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      // One player per run, named in the page URL (`?player=`). On the
      // deployed Worker each browser mints its own id, so without it the
      // fresh context below is a NEW player and finds no save to restore
      // (on `localhost` every browser shared one id, which hid this).
      const player = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const url = `/aftersign/?slot=${slot}&player=${player}`;

      // --- ARM: play the sealed-packet delivery in the SEED context.
      // The packet stays sealed by default (see sibling durable-return-
      // session-phone-playtest.spec.ts, which pins the same "no
      // open-tap → sealed outcome" contract). The single delivery
      // tap on the rendered `#deliverButton` lands `packet-delivered`
      // with `delivery.outcome === "sealed"` and writes the server-
      // authoritative save. NO `window.__game.input.*` for drive.
      //
      // #2336 timing: deliverPacket() writes the durable save TWICE —
      // a synchronous `persistAuthoritative()` at `packet-delivered`
      // AND a second write inside a 1180ms setTimeout AFTER
      // `setBeat("io-return-recognition")`. If the second write
      // lands, the authoritative restore target becomes
      // `io-return-recognition`, not `packet-delivered`, and this
      // spec's premise (cold-boot into `packet-delivered`) disappears.
      // To keep the seed save at `packet-delivered` we patch
      // `window.setTimeout` BEFORE boot to drop any 1180ms-delay
      // scheduled callback — that is the only setTimeout in
      // deliverPacket() and dropping it leaves the synchronous
      // `packet-delivered` save as the authoritative one.
      // `page.addInitScript` runs this before any page JS executes,
      // including the composer/three.js boot, so the patched timer
      // is in place when deliverPacket() queues its callback.
      await dropDeliveryAutoAdvance(page);

      await page.goto(url, { waitUntil: "load" });
      await waitForReady(page);

      const boot = await snapshot(page);
      expect(boot.scene.beat).toBe("packet-offered");
      expect(boot.packet.delivered).toBe(false);

      await tap(page, "#deliverButton");
      await expect
        .poll(async () => (await snapshot(page)).packet.delivered, { timeout: WAIT_MS })
        .toBe(true);

      const delivered = await snapshot(page);
      expect(delivered.delivery.outcome).toBe("sealed");
      // The 1180ms auto-advance was dropped by the init-script patch
      // above, so the beat stays at `packet-delivered`. If this ever
      // reds, deliverPacket()'s delay changed and the patch filter
      // needs to track it.
      expect(delivered.scene.beat).toBe("packet-delivered");

      // --- ACT: fresh browser context (no storage) → boot the same slot.
      const coldPage = await openFreshPhoneContext(browser);
      try {
        await coldPage.goto(url, { waitUntil: "load" });
        await waitForReady(coldPage);

        // #2747: the shared `restoreFlagshipBeat` guard promotes a
        // delivered `packet-delivered` save to `io-return-recognition`
        // on cold boot. The seed save above is exactly that racy pair
        // (sync save landed, 1180ms recognition save dropped), so the
        // returning player must land DIRECTLY on the recognition beat
        // with zero taps — no intermediate "Return to Io" step, and
        // never the intermediate delivery line.
        const restored = await snapshot(coldPage);
        expect(restored.scene.beat).toBe("io-return-recognition");
        expect(restored.packet.delivered).toBe(true);
        expect(restored.delivery.outcome).toBe("sealed");

        await expect(coldPage.locator("#line")).toBeVisible();
        await expect(coldPage.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE);
        await expect(coldPage.locator("#line")).not.toHaveText(SEALED_DELIVERED_LINE);
      } finally {
        await coldPage.context().close();
      }
    },
  );
});
