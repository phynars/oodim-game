import { expect, test, type Page } from "@playwright/test";

// #2217 (daily playtest, June Hallow) — AFTERSIGN round 2 promised the
// red tag to Saint Orra, then the next packet surface replayed the
// blue-packet loop. The reporter tapped `#packetButton` after accepting
// the second packet; the pre-fix `accept-second-packet` branch only
// flipped `state.player.secondPacketHandoffAccepted` and left the
// visible packet tile reading "Blue packet — Seal intact". The fix in
// `aftersign/main.js` arms the red-tag identity (same shape the
// `deliver-packet` branch already applied) at the moment of accept, so
// whichever tap the player takes next — `#deliverButton` ("Deliver
// next packet", the proven path) OR `#packetButton` (the slip path the
// playtest exposed) — `#packetButton` already reads
// "Red tag — Saint Orra" and `state.delivery.id === "red-tag"` is set.
//
// This spec drives the SAME proven two-tap handoff the sibling spec
// `m-loop-second-packet-continuation.playtest.spec.ts` drives
// (accept-second-packet → deliver-packet → packet-offered), and ALSO
// pins the new post-accept invariant: after `accept-second-packet` and
// BEFORE the next deliver-packet tap, `#packetButton` already reads
// the red-tag label. That's the player-visible fix for #2217 — the
// Blue packet tile cannot linger past the accept tap.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
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

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

test.describe("AFTERSIGN second-packet Saint Orra handoff (#2217)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("the red tag lands on #packetButton at accept, not only after the next deliver tap", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=second-packet-orra-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round one — sealed delivery, kind return, ask for next job.
    // Same walk as `red-tag-second-packet-served.spec.ts` and
    // `m-loop-second-packet-continuation.playtest.spec.ts`.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    const packetButton = page.locator("#packetButton");

    // Round two accept — the fix for #2217 arms the red-tag identity
    // inline in `choose("accept-second-packet")`, so the visible
    // packet tile is already "Red tag — Saint Orra" BEFORE the next
    // tap. In the live-verify report the tile was still "Blue packet
    // — Seal intact" at this point, which is what led the player to
    // tap `#packetButton` and replay the blue loop.
    const accept = page.locator('button[data-choice-id="accept-second-packet"]');
    await expect(accept).toBeVisible({ timeout: WAIT_MS });
    await accept.tap();
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // The beat is still `io-next-job`; completing the handoff is the
    // existing two-tap flow — tap `#deliverButton` ("Deliver next
    // packet") to advance to `packet-offered`. The sibling specs
    // listed in the file header pin this exact next step.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await expect(page.locator("#offeredJobs")).toContainText(/Saint Orra/i);
  });
});
