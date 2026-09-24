import { expect, test, type Browser, type Page } from "@playwright/test";

// #1907 visible-DOM-only cold-boot affordance spec.
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

// Sealed-packet path: keep-sealed → deliver-packet. `packet-delivered`
// restores with the returning-session sealed/skipped-route line, and the
// recognition line the visible advance control must produce is the
// "sealed, skipped-route" branch of `expectedIoRecognitionLine`.
const SEALED_DELIVERED_LINE = ioReturningSessionLines.sealedPacketSkippedRoute;
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
  // A brand-new context: no cookies, no localStorage. Assert the storage
  // gap explicitly so a later restore cannot be satisfied by the previous
  // context's cached save.
  await page.goto("/aftersign/", { waitUntil: "load" });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.length), { timeout: WAIT_MS })
    .toBe(0);
  return page;
}

test.describe("AFTERSIGN packet-delivered cold-boot affordance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test(
    "cold-boot restore into packet-delivered exposes a visible advance control that reaches io-return-recognition on tap",
    async ({ browser, page }) => {
      test.setTimeout(COLD_BOOT_MS);

      const slot = `packet-delivered-cold-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const url = `/aftersign/?slot=${slot}`;

      // --- ARM: play the sealed-packet delivery in the SEED context.
      // The packet stays sealed by default (see sibling durable-return-
      // session-phone-playtest.spec.ts, which pins the same "no
      // open-tap → sealed outcome" contract). The single delivery
      // tap on the rendered `#deliverButton` lands `packet-delivered`
      // with `delivery.outcome === "sealed"` and writes the server-
      // authoritative save. NO `window.__game.input.*` for drive.
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

      // --- ACT: fresh browser context (no storage) → boot the same slot.
      const coldPage = await openFreshPhoneContext(browser);
      try {
        await coldPage.goto(url, { waitUntil: "load" });
        await waitForReady(coldPage);

        // Restored line assertion: the returning-session sealed/skipped-
        // route line lands in `#line` before ANY player tap. This is the
        // "correct dialogue restored, zero visible taps" precondition
        // Mara flagged on #1907 — we prove the line is right AND that
        // an advance control is present, in that order.
        await expect(coldPage.locator("#line")).toBeVisible();
        await expect(coldPage.locator("#line")).toHaveText(SEALED_DELIVERED_LINE);

        const restored = await snapshot(coldPage);
        expect(restored.scene.beat).toBe("packet-delivered");
        expect(restored.packet.delivered).toBe(true);
        expect(restored.delivery.outcome).toBe("sealed");

        // The advance control must be RENDERED, VISIBLE, ENABLED, and
        // carry the authored "Return to Io" label — the shipped
        // affordance for the packet-delivered restore path.
        const advanceControl = coldPage.locator("#deliverButton");
        await expect(advanceControl).toBeVisible();
        await expect(advanceControl).toBeEnabled();
        await expect(advanceControl).toHaveText("Return to Io");

        // The tap — the ONLY drive on the cold-boot page. No
        // `window.__game.input.*`, no forceSave/forceReload, no
        // choice injection; just the finger the returning player
        // has on the phone.
        await advanceControl.tap();

        // Recognition line lands in `#line`. This is the acceptance
        // criterion: the visible advance control produced the
        // io-return-recognition beat + line, not the harness.
        await expect(coldPage.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE);

        const advanced = await snapshot(coldPage);
        expect(advanced.scene.beat).toBe("io-return-recognition");
        expect(advanced.npcs.io.lastLine).toBe(SEALED_RECOGNITION_LINE);
      } finally {
        await coldPage.context().close();
      }
    },
  );
});
