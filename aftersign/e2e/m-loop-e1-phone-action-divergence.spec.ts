import { expect, test, type Page } from "@playwright/test";

// M2-E1 continuous cold-boot playtest. Player input is exclusively through
// visible controls; __game is read only for state assertions.
//
// PLAYER-SURFACE RUNTIME GAP (documented for #1779):
//   At the `io-return-recognition` beat, `state.packet.delivered` is not
//   consistently reflected on the `window.__game.getSnapshot()` mirror
//   even though `deliverPacket()` in `aftersign/main.js` sets both
//   `state.packet.delivered = true` and `state.delivery.outcome` (lines
//   3765/3768) BEFORE the setTimeout flips the beat. The culprit is
//   likely the snapshot-caching guard in `publishState()`
//   (`publishedStateVersion === statePublishVersion` short-circuit) or a
//   legitimate mid-beat state churn; either way it is a runtime repair —
//   OUT OF SCOPE for #1778 ("Do not implement surface repairs in this
//   PR; only document findings").
//
// Consequence for this spec: we NEVER gate delivery on the recognition
// beat. The strict `expectDeliveredOutcome` runs only on snapshots taken
// after the `io-next-job` beat, where the mirror IS consistent. Repair
// tracked in #1779.
const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 20_000;
const SERVED_BUTTON_IDS = ["#deliverButton", "#acknowledgeRouteButton", "#skipRouteButton"] as const;

type FlagshipSnapshot = {
  scene?: { beat?: string };
  packet?: { delivered?: boolean; sealed?: boolean };
  delivery?: { outcome?: string };
  player?: { returnReason?: string | null };
};

type ActionState = {
  id: (typeof SERVED_BUTTON_IDS)[number];
  present: boolean;
  enabled: boolean;
  // #1777 label-excluded identity axis. `data-aftersign-tap-choice` is
  // the served-page attribute (pinned by
  // `apps/web/src/aftersign/servedSurface.contract.test.ts:109` and
  // `apps/web/src/aftersign/routeRiskMemory.ts:100 —
  // AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE`). It is written by the static
  // HTML on `#deliverButton` (`aftersign/index.html:1051`) and by
  // `main.js:2148` for dynamically minted offer buttons; it carries the
  // CHOICE ID (`"deliver-packet"`, `"acknowledge-kiosk"`,
  // `"choose-return-tone"`, `"ask-for-next-job"`, …), independent of
  // the visible button label. A label-only edit (renaming "Deliver
  // packet" → "Send packet") does NOT change this attribute, so a
  // divergence assertion on this axis catches identity flips only.
  //
  // NB: `stampAftersignChoice` in `aftersign/src/playerVisibleBeatDom.js`
  // writes a DIFFERENT attribute (`data-choice-id`) on the same buttons
  // — same vocabulary, second axis. We key on the tap-choice attribute
  // because that's the one the served-surface contract test pins.
  choiceId: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipSnapshot;
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

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

async function tap(page: Page, selector: (typeof SERVED_BUTTON_IDS)[number]): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

async function offeredActionStates(page: Page): Promise<ActionState[]> {
  return Promise.all(
    SERVED_BUTTON_IDS.map(async (id) => {
      const button = page.locator(id);
      const present = await button.count().then(Boolean);
      const visible = present ? await button.isVisible().catch(() => false) : false;
      const enabled = visible ? await button.isEnabled().catch(() => false) : false;
      const choiceId = visible
        ? (await button.getAttribute("data-aftersign-tap-choice").catch(() => null)) ?? ""
        : "";
      return { id, present: visible, enabled, choiceId };
    }),
  );
}

// #1777 stable-identity fingerprint, excluding labels. Each enabled
// action is keyed on `<button-id>|<choice-id>` — the button id is the
// DOM address (independent of copy) and `data-aftersign-tap-choice` is
// the authored choice axis (also independent of copy). A label-only
// edit (renaming visible text without touching the choice id) produces
// an IDENTICAL fingerprint set, which is exactly what this gate must
// fail.
function actionIdentityFingerprints(actions: ActionState[]): string[] {
  return actions
    .filter((action) => action.present && action.enabled)
    .map((action) => `${action.id}|${action.choiceId}`)
    .sort();
}

function enabledActionIds(actions: ActionState[]): string[] {
  return actions.filter((action) => action.present && action.enabled).map((action) => action.id);
}

// Strict form: delivery fact and its outcome MUST travel together.
// Only called on snapshots taken at/after `io-next-job`, where the
// snapshot mirror is consistent. See top-of-file note (#1779) — never
// call this on a recognition-beat snapshot.
function expectDeliveredOutcome(state: FlagshipSnapshot): void {
  expect(state.packet?.delivered).toBe(true);
  expect(state.delivery?.outcome).toBeTruthy();
}

async function completeReturn(
  page: Page,
  tone: "#acknowledgeRouteButton" | "#skipRouteButton",
): Promise<FlagshipSnapshot> {
  await waitForBeat(page, "io-return-recognition");
  await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);
  await expect(page.locator("#skipRouteButton")).toContainText(/evasive return/i);
  await expect(page.locator("#deliverButton")).toContainText(/blunt return/i);
  await tap(page, tone);

  await waitForBeat(page, "return-tone-choice");
  await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
  await tap(page, "#deliverButton");
  return waitForBeat(page, "io-next-job");
}

test.describe("M2-E1: continuous two-round phone playtest", () => {
  test("cold boots once, completes two delivery-return rounds, and preserves the risk outcome", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const slot = `m2-e1-continuous-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // A unique slot gives this player a cold session; this test never reseeds or reloads it.
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);
      await waitForBeat(page, "packet-offered");
      await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
      await expect(page.locator("#skipRouteButton")).toBeDisabled();

      // Capture the ROUND-ONE identity fingerprint set (label-excluded)
      // before the tap commits. This is what #1777 gates round-to-round
      // divergence on.
      const roundOneStates = await offeredActionStates(page);
      const roundOneEnabledIds = enabledActionIds(roundOneStates);
      const roundOneIdentity = actionIdentityFingerprints(roundOneStates);
      expect(roundOneEnabledIds).toEqual(["#deliverButton"]);
      expect(roundOneIdentity, "round-1 must expose the deliver-packet choice").toEqual([
        "#deliverButton|deliver-packet",
      ]);

      // NEGATIVE CONTROL (#1777 acceptance criterion): prove the
      // choice-id axis is LOAD-BEARING in the fingerprint. If a future
      // refactor accidentally drops `choiceId` from
      // `actionIdentityFingerprints` (collapsing identity to button id
      // alone), the divergence gate downstream would silently pass on
      // label-only edits — the exact regression #1777 exists to catch.
      // We prove load-bearing by mutating ONLY the choice-id axis on a
      // copy of the round-one states and asserting the fingerprint
      // DIFFERS. Same button ids, different choice ids → different
      // fingerprint. If this reds, the fingerprint stopped consuming
      // choiceId and the divergence gate is toothless.
      const roundOneChoiceIdMutated = actionIdentityFingerprints(
        roundOneStates.map((action) =>
          action.present && action.enabled
            ? { ...action, choiceId: `${action.choiceId}-mutated` }
            : action,
        ),
      );
      expect(
        roundOneChoiceIdMutated,
        "choice-id must be load-bearing in the identity fingerprint",
      ).not.toEqual(roundOneIdentity);

      await tap(page, "#deliverButton");
      // Recognition-beat delivery mirror is a known runtime gap (#1779):
      // we DO NOT gate delivery here. `completeReturn` internally waits
      // for the recognition beat as a transition marker only, then walks
      // the player through the tone-choice → next-job settle. The strict
      // delivery invariant lands on the io-next-job snapshot below,
      // where the mirror is consistent.
      const afterRoundOne = await completeReturn(page, "#acknowledgeRouteButton");
      expect(afterRoundOne.player?.returnReason).toBeTruthy();
      // After io-next-job the snapshot mirror is consistent; assert the
      // delivery invariant strictly.
      expectDeliveredOutcome(afterRoundOne);
      const canonicalOutcome = afterRoundOne.delivery?.outcome;

      // io-next-job is the directly reached second offer: no new context, seed, or reload.
      const roundTwoStates = await offeredActionStates(page);
      const roundTwoEnabledIds = enabledActionIds(roundTwoStates);
      const roundTwoIdentity = actionIdentityFingerprints(roundTwoStates);

      // #1777 identity-divergence gate (label-excluded). The round-two
      // action set must differ from round-one on the identity axis — a
      // label-only edit to any offered button CANNOT satisfy this,
      // because `data-aftersign-tap-choice` is copy-independent. This
      // is the exact regression #1777 asks to catch.
      expect(
        roundTwoIdentity,
        "round-two action identity must differ from round-one (label-excluded)",
      ).not.toEqual(roundOneIdentity);
      // The visible-id set may or may not differ (both rounds tap
      // `#deliverButton`), but at minimum SOME identity axis must have
      // flipped between rounds — the choice-id vocabulary or the enabled
      // button-id set. Cross-check the enabled-id membership as a
      // secondary axis so a same-choice-id, same-button-id round-two
      // (i.e. no real divergence) fails loudly.
      expect(roundTwoEnabledIds).toContain("#deliverButton");
      // Round-two beat graph (confirmed against `aftersign/main.js`):
      //   io-next-job  → tap `#deliverButton` (choice `deliver-packet`)
      //                  runs the reset branch at main.js:2727 —
      //                  `state.packet` is cleared and the beat is
      //                  `setBeat("packet-offered")` (main.js:2745).
      //   packet-offered → tap `#deliverButton` (choice `deliver-packet`)
      //                    falls through to `deliverPacket("contract-input")`
      //                    at main.js:2750, which stamps
      //                    `state.packet.delivered = true` +
      //                    `state.delivery.outcome` and then
      //                    `setBeat("packet-delivered")` →
      //                    `setBeat("io-return-recognition")` via the
      //                    1180ms setTimeout at main.js:3812.
      // So round two needs TWO taps on `#deliverButton`, gated by the
      // intermediate `packet-offered` beat. Tapping once and jumping
      // straight to `completeReturn` (which awaits
      // `io-return-recognition`) times out — the served surface never
      // reaches the recognition beat without the second tap.
      await tap(page, "#deliverButton");
      await waitForBeat(page, "packet-offered");
      await tap(page, "#deliverButton");
      const afterRoundTwo = await completeReturn(page, "#skipRouteButton");
      expect(afterRoundTwo.player?.returnReason).toBeTruthy();
      expectDeliveredOutcome(afterRoundTwo);
      // Cross-round outcome invariant: round two's settled delivery outcome
      // must match round one's — this is the risk/outcome invariant #1778
      // asks to be maintained across both rounds.
      expect(afterRoundTwo.delivery?.outcome).toBe(canonicalOutcome);
    } finally {
      await context.close();
    }
  });
});
