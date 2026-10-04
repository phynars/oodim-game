import { expect, test, type Page } from "@playwright/test";
import { IO_RETURN_TONE_OPTIONS } from "../../apps/web/src/aftersign/story/ioContinueBeats.ts";

// AFTERSIGN return-to-Io settle guard — proves issue #2174 element-level
// through visible DOM only, no `window.__game` snapshot reads.
//
// Bug (#2174): on the `packet-delivered` beat, `#deliverButton` is
// labelled "Return to Io". On `io-return-recognition` the SAME DOM
// node becomes the Blunt return-tone button
// (`data-return-reason="blunt"`). The settle gate is supposed to drop
// the second interpretation of one gesture, but the issue reports the
// gate's `recognitionEnteredAt` stamp is missing on the `return-to-io`
// path, so a single tap of "Return to Io" silently records a BLUNT
// return and Io speaks her blunt reply the player never asked for.
//
// Acceptance (from the issue): after tapping "Return to Io" by pointer,
// NO tone-reply line is shown until a tone button is tapped. Then
// tapping the Evasive tone surfaces Io's evasive reply.
//
// Observation discipline mirrors `aftersign-packet-recall-feel.playtest.spec.ts`:
//   - 390x844 hasTouch viewport, `.tap()` on `button[data-return-reason]`
//     (NOT the shared `#deliverButton` node, NOT the shared
//     `#skipRouteButton` node).
//   - All assertions read the served `#line` paragraph. Expected copy
//     comes from the shipped `IO_RETURN_TONE_OPTIONS` module so a
//     future author re-write of the replies updates this spec in one
//     place and never drifts.
//   - No `page.waitForTimeout` — we poll the served DOM instead so the
//     spec is not timing-dependent.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

const BLUNT_REPLY = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "blunt")!.reply;
const EVASIVE_REPLY = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "evasive")!
  .reply;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
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

test.describe("AFTERSIGN return-to-Io settle guard (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tapping Return to Io does not record a tone — only an explicit tone tap does", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh slot — forces the first-visit safe-default offer so the
    // route-risk tray is reachable without stepping on a stale save.
    await page.goto(`/aftersign/?slot=return-to-io-settle-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");

    // Take the safe-delivery offer so the deterministic route-risk
    // tray appears (same path the packet-recall sibling walks). The
    // settle-gate bug is on the return-to-Io path AFTER delivery, so
    // the route taken here doesn't matter beyond reaching it.
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const safeRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(safeRouteButton).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();
    await expect(safeRouteButton).toBeHidden({ timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    // `#deliverButton` is the shared node that relabels across beats
    // — the exact element the bug conflates. Tap it as "Return to Io".
    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toHaveText("Return to Io", { timeout: WAIT_MS });
    await deliverButton.tap();

    // The tap must land us on the recognition beat with the tone
    // buttons visible — observable through `[data-beat-id]` and the
    // `[data-return-reason]` locators the renderer stamps.
    await waitForBeat(page, "io-return-recognition");
    await expect(
      page.locator('button[data-return-reason="blunt"]'),
      "blunt tone button should render on io-return-recognition",
    ).toBeVisible({ timeout: WAIT_MS });

    // #2174 acceptance: no tone reply is shown yet. Io's blunt reply
    // "Good. Wanting is easier to route than pretending." must not
    // appear in `#line` from the Return-to-Io tap alone — a tone
    // reply only lands AFTER an explicit tone tap.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(
      line,
      "no tone reply should render until a tone button is tapped",
    ).not.toContainText(BLUNT_REPLY);

    // Now explicitly choose the EVASIVE tone through its dedicated
    // button — a DIFFERENT DOM node than `#deliverButton`, same
    // vocabulary as `aftersign-packet-recall-feel.playtest.spec.ts`.
    const evasiveButton = page
      .locator('button[data-return-reason="evasive"]:not([disabled])')
      .first();
    await expect(evasiveButton).toBeVisible({ timeout: WAIT_MS });
    await evasiveButton.tap();

    // Only now does the evasive reply surface in `#line`.
    await expect(
      line,
      "evasive reply should render after the evasive tone is tapped",
    ).toContainText(EVASIVE_REPLY, { timeout: WAIT_MS });

    // And the blunt reply must NEVER have been spoken on this path —
    // the false-memory the bug produced.
    await expect(
      line,
      "blunt reply must never render when the player chose evasive",
    ).not.toContainText(BLUNT_REPLY);
  });
});
