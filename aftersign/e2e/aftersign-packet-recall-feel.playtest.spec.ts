import { expect, test, type Page } from "@playwright/test";
import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";

// state.player.routeRisk is written ONLY by renderRouteRiskChoice's
// onChoose callback on a `#routeRiskChoice` tray tap — the
// `acknowledge-kiosk` → `deliver-packet` path never populates it.
// (Reviewer note on PR #2012, confirmed by
// `aftersign-route-risk-outcome-line-served.spec.ts` — the green
// sibling for the same routeRisk axis.) So round 1 MUST tap the
// SAFE route button (`take-the-long-way`) before `acknowledge-kiosk`,
// or the main.js recall-token derivation stays null and the recall
// paragraph never stamps at round-2 `packet-offered`.

// AFTERSIGN packet-recall (tap-driven) — plays a phone viewport
// through round 1's safe delivery, loops back to `packet-offered`,
// and asserts the recalled "safe" line renders on a VISIBLE sibling
// of `#line` at `#packetRecallLine`.
//
// The mechanic under test is the persistent-memory beat's whole
// point: at the next offer, Io names the route the player actually
// ran last time — beside (not inside) the beat-owned dialogue line.
//
// Selector + boot vocabulary mirrors the sibling
// `m-loop-e1-two-round-playtest.spec.ts` (the divergence proof this
// spec neighbours). SwiftShader cold-start regularly overruns 5s;
// the fresh `?slot=` forces the first-visit safe-default offer so
// round 1 runs the "safe" route.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

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

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

test.describe("AFTERSIGN packet-recall (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("names the safe route Io remembers when the beat loops back to packet-offered", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh slot — round 1 is a true first visit (packet.delivered
    // === false, no routeRisk on record) so the safe-default offer
    // is the only tappable action, and round 2 arrives at
    // `packet-offered` with a completed safe-route memory on the
    // same durable record.
    await page.goto(`/aftersign/?slot=packet-recall-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    // ── ROUND 1 — first visit; no recall paragraph exists yet ─────────
    await waitForBeat(page, "packet-offered");
    expect(
      await page.locator(`#${PACKET_RECALL_LINE_ID}`).count(),
      "no recall paragraph on the first visit — nothing to remember yet",
    ).toBe(0);

    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    // Tap the SAFE route on the `#routeRiskChoice` tray — this is
    // the ONLY tap path that fires renderRouteRiskChoice's onChoose,
    // which calls recordRouteRun and writes
    // `state.player.routeRisk = { lastRoute: "safe", succeeded: true }`.
    // Without this tap the memory fact never persists, main.js
    // derives `packetRecallToken === null`, and the round-2 stamp
    // tears the paragraph down instead of rendering it. Selector +
    // poll shape mirror `aftersign-route-risk-outcome-line-served.spec.ts`.
    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const safeRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(safeRouteButton).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();
    // The tray’s visible completion is the player-facing proof that the
    // route tap committed. Do not inspect the game snapshot here: this
    // acceptance path must remain driven and observed through the served UI.
    await expect(safeRouteButton).toBeHidden({ timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");

    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // ── ROUND 2 — looped return; recall must render on a sibling ──────
    await waitForBeat(page, "packet-offered");

    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recall,
      "recall paragraph must render at packet-offered when a prior route exists",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(
      PACKET_RECALL_LINE_DATA_ATTR,
      "safe",
    );

    // Copy is derived from the shipped copy module — never a literal
    // re-declaration. Drift on the "safe" branch reds here.
    const expected = aftersignPacketRecallLine("safe");
    expect(expected).not.toBe("");
    await expect(recall).toHaveText(expected);

    // Sibling, not overwrite: `#line` still owns the beat dialogue,
    // and the recall lives in a distinct DOM node right after it.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    const lineText = (await line.textContent())?.trim() ?? "";
    const recallText = (await recall.textContent())?.trim() ?? "";
    expect(
      lineText,
      "beat dialogue line must not be overwritten by the recall paragraph",
    ).not.toBe(recallText);

    // Recall is the immediate next sibling of #line — proves the
    // stamp lands where the render module documents, not somewhere
    // else in the DOM that happens to be visible.
    const isNextSibling = await page.evaluate(
      ({ lineId, recallId }) => {
        const l = document.getElementById(lineId);
        const r = document.getElementById(recallId);
        return Boolean(l && r && l.nextElementSibling === r);
      },
      { lineId: "line", recallId: PACKET_RECALL_LINE_ID },
    );
    expect(
      isNextSibling,
      "recall paragraph must be the immediate next sibling of #line",
    ).toBe(true);
  });
});
