// Tap-driven e2e (PR #1874) — proves Io's Saint-Orra pointer line
// (`ioSecondPacketResponseVoice.ts::ioSecondPacketResponseLine`)
// renders on the SHIPPED served page after a real player tap on the
// two second-packet choice buttons. Same tap path as the sibling
// spec `io-second-packet-copy-served.spec.ts`, which walks the
// player through:
//     packet-offered → packet-choice → packet-delivered →
//     io-return-recognition → return-tone-choice → io-next-job
// At `io-next-job` the two choice buttons `#acknowledgeRouteButton`
// (choices[0] — `accept-second-packet`) and `#skipRouteButton`
// (choices[1] — `ask-what-changed`) are visible, labeled from the
// sibling copy contract. A tap on either commits the fork; this
// spec asserts the pointer line then lands in the
// `#ioSecondPacketPointer` sibling paragraph next to `#line`,
// with the SAME literal `ioSecondPacketResponseLine(id)` returns.
//
// This closes the AI006 "unconsumed surface" gap Soren flagged on
// draft 1: the pointer voice module is now consumed by main.js
// (via `apps/web/src/aftersign/ioSecondPacketPointerRender.ts` +
// a delegated click listener), and this spec real-taps a phone
// viewport to prove the rendered pointer is on the shipped surface.

import { expect, test, type Page } from "@playwright/test";

import {
  ioSecondPacketResponseLine,
} from "../src/ioSecondPacketResponseVoice.ts";
// AI005 fix (Soren, PR #1874 review): import the pointer id +
// data-attr from the render module rather than hardcoding the
// literals. A rename on the render module now reds this spec at
// typecheck / import time, not on the played surface.
import {
  IO_SECOND_PACKET_POINTER_DATA_ATTR,
  IO_SECOND_PACKET_POINTER_ID,
} from "../../apps/web/src/aftersign/ioSecondPacketPointerRender.ts";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

type ReturnReason = "kind" | "evasive" | "blunt";

type FlagshipReadOnlySnapshot = {
  scene: { beat: string };
  player: { returnReason?: string | null; name?: string | null };
};

declare global {
  interface Window {
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

async function waitForBeat(page: Page, beat: string): Promise<FlagshipReadOnlySnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

const cases: Array<{
  readonly reason: ReturnReason;
  readonly toneSelector: string;
  readonly choiceId: "accept-second-packet" | "ask-what-changed";
  readonly choiceSelector: string;
}> = [
  {
    reason: "kind",
    toneSelector: "#acknowledgeRouteButton",
    choiceId: "accept-second-packet",
    choiceSelector: "#acknowledgeRouteButton",
  },
  {
    reason: "blunt",
    toneSelector: "#deliverButton",
    choiceId: "ask-what-changed",
    choiceSelector: "#skipRouteButton",
  },
];

test.describe("AFTERSIGN Saint-Orra pointer renders after a second-packet choice tap", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const c of cases) {
    test(`tapping "${c.choiceId}" after a ${c.reason} return renders the pointer line`, async ({ page }) => {
      const slot = `io-second-packet-pointer-${c.choiceId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);

      // Play to io-return-recognition via real tap on #deliverButton.
      await expect(page.locator("#deliverButton")).toBeVisible();
      await tap(page, "#deliverButton");
      await waitForBeat(page, "io-return-recognition");

      // Post the return tone.
      await tap(page, c.toneSelector);
      await waitForBeat(page, "return-tone-choice");

      // Ask for the next job — the button is re-labeled at this beat.
      await expect(page.locator("#deliverButton")).toHaveText("Ask for next job");
      await tap(page, "#deliverButton");
      await waitForBeat(page, "io-next-job");

      // At `io-next-job`, the two second-packet choice buttons are
      // stamped by the sibling copy module. Before the tap, the
      // pointer paragraph does NOT exist.
      const pointerSelector = `#${IO_SECOND_PACKET_POINTER_ID}`;
      await expect(page.locator(pointerSelector)).toHaveCount(0);

      // Real tap on the choice button — the delegated click listener
      // in main.js stamps the pointer.
      await tap(page, c.choiceSelector);

      // The pointer paragraph now exists with the exact literal from
      // ioSecondPacketResponseLine(choiceId) and the choice-id data
      // attribute — both sourced from the render module's exports so
      // a rename reds this spec at import time, not on the surface.
      const expectedPointer = ioSecondPacketResponseLine(c.choiceId);
      const pointer = page.locator(pointerSelector);
      await expect(pointer).toBeVisible({ timeout: WAIT_MS });
      await expect(pointer).toHaveText(expectedPointer);
      await expect(pointer).toHaveAttribute(
        IO_SECOND_PACKET_POINTER_DATA_ATTR,
        c.choiceId,
      );
      // Every pointer variant names the next door — the reason the
      // module exists.
      expect(expectedPointer).toContain("Saint Orra");
    });
  }
});
