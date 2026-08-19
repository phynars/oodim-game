import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN return-tone choice FEEL trip-wire — phone-shaped playtest.
//
// SCOPE. Where the sibling `io-continue-beats-tap-playtest.spec.ts`
// pins ALL THREE authored replies + the durable-save proof, this spec
// is the JUICE-lane trip-wire: ONE fresh run through the fork,
// asserting that the visible tap on "Kind return" produces a tactile,
// on-screen response (the authored reply verbatim, at `#line`) at the
// `return-tone-choice` beat AND that the tuned press-envelope feel
// numbers land on `[data-aftersign-return-surface]` at
// `io-return-recognition` — one CSS-var snapshot per posture, pinned
// against the `kind` row in `returnToneChoiceFeel.ts`. If a future
// feel refactor drops the press-envelope wiring on
// `applyReturnToneFeel()` and silently clobbers the reply render OR
// the stamped CSS variables drift from the pinned row, this trip-wire
// reds first because it runs in the phone tap lane (`hasTouch: true`
// synthesizes touch events; the click-only path would miss a
// touch-only wiring gap).
//
// KIND-PATH DISCIPLINE (Soren PR #1314 re-review). The `applyReturnToneFeel`
// call site in main.js:987 computes the posture from durable state:
//   const routeAttention = secondActionFromMemory(...) === DONE
//     ? "listened" : "skipped";
//   const returnToneReason = !state.packet.sealed
//     ? "evasive"
//     : routeAttention === "listened" ? "kind" : "blunt";
// So to drive the KIND branch (which this trip-wire pins), the play
// path MUST record `acknowledge-kiosk` at `packet-choice` BEFORE
// `deliver-packet` mints the route-attention fact. Skipping the
// kiosk-acknowledge tap lands `routeAttention="skipped"` and the
// runtime stamps the BLUNT row, red-ing the KIND_RETURN_FEEL
// assertion. The feel snapshot is taken at `io-return-recognition`
// (where the applier runs) — after that beat, tapping "Kind return"
// advances to `return-tone-choice` for the reply proof.
//
// LOCATION. Lives at `aftersign/e2e/` — the repo-root tree the
// `aftersign/playwright.config.ts` `testDir: "e2e"` config scans.
// A prior draft parked under `apps/web/src/aftersign/e2e/`, which no
// Playwright config scans — dead file (Soren PR #1304 review).
//
// PLAYED, NOT DRIVEN (BRIEF 2026-08-15). Every advance is a real tap
// on a visible, enabled DOM button; `window.__game` reads appear
// exclusively in ASSERTIONS (scene.beat + published state shape),
// never as an input driver.
//
// SERVED-DOM AUTHORITY. Button labels are asserted VERBATIM against
// what the served page writes to the three fork-button text nodes at
// `io-return-recognition`:
//   #acknowledgeRouteButton → "Kind return"
//   #skipRouteButton        → "Evasive return"
//   #deliverButton          → "Blunt return"
// At the preceding `packet-choice` beat the SAME three DOM nodes
// carry different labels (Acknowledge route / Skip acknowledgment /
// Deliver packet) and the SAME `#acknowledgeRouteButton` node stamps
// `data-aftersign-tap-choice="acknowledge-kiosk"` — the label swap
// is what makes the phone tap-lane trip-wire load-bearing.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

const KIND_RETURN_REPLY =
  "Careful. Say that too often and people will start handing you breakable things.";

// Pinned by `apps/web/src/aftersign/returnToneChoiceFeel.ts` (the `kind`
// row) + the applier's unit-suffix formatting. If the pinned row moves,
// `returnToneChoiceFeel.contract.test.ts` reds first — this trip-wire
// mirrors those numbers verbatim so a drift here means an intentional
// spec change, not a fabrication. Only the CSS vars the return-tone
// seam ACTUALLY writes are asserted; press-scale / glow-px / duration-ms
// belong to the tap-confirm seam and are out of scope here.
const KIND_RETURN_FEEL = {
  toneHz: "392",
  attackMs: "8ms",
  releaseMs: "180ms",
  gain: "0.055",
  liftPx: "5px",
  shakePx: "0px",
  easing: "cubic-bezier(0.2, 0.9, 0.18, 1)",
};

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = window.__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

const tap = async (page: Page, selector: string): Promise<void> => {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

const expectKindReturnFeelStamped = async (page: Page): Promise<void> => {
  // Poll the applier's output — `applyReturnToneFeel("kind")` fires
  // inside `syncIoLine()` on the render tick that lands
  // `io-return-recognition`, and the CSS variables are written
  // synchronously on the [data-aftersign-return-surface] node. Polling
  // (rather than a one-shot read) tolerates the render lag between
  // `waitForBeat` returning and the applier finishing its stamp.
  await expect
    .poll(
      () =>
        page.locator("#aftersignReturnSurface").evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            tone: node.getAttribute("data-aftersign-return-tone"),
            toneHz: style.getPropertyValue("--aftersign-return-tone-hz").trim(),
            attackMs: style
              .getPropertyValue("--aftersign-return-tone-attack-ms")
              .trim(),
            releaseMs: style
              .getPropertyValue("--aftersign-return-tone-release-ms")
              .trim(),
            gain: style.getPropertyValue("--aftersign-return-tone-gain").trim(),
            liftPx: style.getPropertyValue("--aftersign-return-lift-px").trim(),
            shakePx: style
              .getPropertyValue("--aftersign-return-shake-px")
              .trim(),
            easing: style.getPropertyValue("--aftersign-return-easing").trim(),
          };
        }),
      { timeout: WAIT_MS },
    )
    .toEqual({
      tone: "kind",
      ...KIND_RETURN_FEEL,
    });
};

test.describe("AFTERSIGN return-tone choice feel (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Kind return tap at io-return-recognition renders the authored reply and stamps the tuned feel surface", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=return-tone-feel-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // packet-offered → tap packet (gesture with no drag preserves the
    // seal) → packet-choice.
    await waitForBeat(page, "packet-offered");
    await tap(page, "#packetButton");

    // packet-choice: at THIS beat `#acknowledgeRouteButton` stamps
    // `data-aftersign-tap-choice="acknowledge-kiosk"` and records
    // `state.player.secondAction = "acknowledge-kiosk"` (SECOND_ACTION
    // .DONE) BEFORE `deliver-packet` mints the route-attention fact.
    // That is what drives `routeAttention === "listened"` at the
    // recognition beat, which — with the sealed packet — routes
    // `returnToneReason` to "kind" in main.js:987. Skip this tap
    // and the applier stamps the "blunt" row instead.
    await waitForBeat(page, "packet-choice");
    await tap(page, "#acknowledgeRouteButton");
    await tap(page, "#deliverButton");

    // deliverPacket() mints the fact + auto-advances (~1180ms
    // setTimeout in main.js) to `io-return-recognition`.
    await waitForBeat(page, "io-return-recognition");

    // Button labels swap at this beat: same three DOM nodes, new
    // text — asserted verbatim against the served render.
    await expect(page.locator("#acknowledgeRouteButton")).toContainText(
      /^\s*Kind return\s*$/,
    );
    await expect(page.locator("#skipRouteButton")).toContainText(
      /^\s*Evasive return\s*$/,
    );
    await expect(page.locator("#deliverButton")).toContainText(
      /^\s*Blunt return\s*$/,
    );

    // Feel-stamp proof — the applier ran because sealed=true +
    // routeAttention="listened" → returnToneReason="kind".
    await expectKindReturnFeelStamped(page);

    await tap(page, "#acknowledgeRouteButton");

    await waitForBeat(page, "return-tone-choice");
    await expect(page.locator("#line")).toHaveText(KIND_RETURN_REPLY, {
      timeout: WAIT_MS,
    });

    await expect(page.locator("#deliverButton")).toContainText(
      /ask for next job/i,
    );
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");
  });
});
