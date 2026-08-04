import { expect, test, type Page } from "@playwright/test";

// Cold-start budget: SwiftShader init + esm.sh cold fetch of three@0.165.0
// + first WebGL context can chew through Playwright's default 30s test
// timeout on a CI runner. Siblings (memory-prior-session, save-slot-isolation)
// set the same 90s ceiling — see PR #463 review for the SwiftShader details.
const COLD_START_MS = 90_000;
// Per-wait budget: any single window.__game observation must survive the
// initial module import + WebGL bring-up on first navigation.
const WAIT_MS = 60_000;
// Responsiveness gate: once the scene is up and the beat is stable, a
// choose() call must land the next beat in under this budget. The harness
// polls waitForFunction at ~100ms, so this measures "the scene reacted"
// rather than sub-frame latency — but a regression that stalls the input
// pump, blocks the main thread, or drops us off the frame clock will blow
// this budget. Generous enough for CI jitter, tight enough to catch a real
// stall: two beat transitions at 2.5s each vs. the 60s cold-wait budget.
const CHOICE_RESPONSE_MS = 2_500;

// NB: the route-choice container is a `<div id="routeChoice" aria-label="…">`
// with `display: none` while `data-visible="false"`. Two consequences for
// locators (this cost the previous run its green light):
//   1. Playwright's `getByLabel` targets FORM CONTROLS (input/textarea/
//      select) via `<label>` / `aria-labelledby`. A plain `<div>` with a
//      loose `aria-label` is NOT in that set — the query resolves nothing
//      and `toHaveAttribute` fails on the empty locator.
//   2. `getByRole('button', { name: … })` walks the accessibility tree,
//      which excludes descendants of a `display: none` ancestor. Pre-seal
//      the buttons live inside the hidden `.route-choice` container, so
//      the ARIA-tree query returns nothing and `toBeDisabled` fails.
// CSS / id selectors bypass both — they locate the DOM element regardless
// of ARIA-tree visibility, and `toBeDisabled` / `toHaveAttribute` still
// read the underlying DOM property + attribute directly.
const ROUTE_CHOICE_SELECTOR = "#routeChoice";
const ACKNOWLEDGE_BUTTON_SELECTOR = "#acknowledgeRouteButton";
const SKIP_BUTTON_SELECTOR = "#skipRouteButton";

type PacketBeat = "packet-offered" | "packet-choice" | "packet-delivered";

type PacketChoiceId =
  | "keep-packet-sealed"
  | "acknowledge-kiosk"
  | "skip-kiosk-acknowledge"
  | "deliver-packet";

type GameSurface = {
  version: 1;
  scene: { beat: PacketBeat; ready?: boolean };
  player?: { secondAction?: "done" | "skipped" | null };
  input: {
    choose(choiceId: PacketChoiceId): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: PacketBeat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

// #736 M2-E1 flake root-cause: `state.scene.beat === "packet-offered"` is
// TRUE from module-init (the state literal seeds it before boot completes),
// so `waitForBeat("packet-offered")` can return BEFORE the very first
// `renderText()` runs — which is the pass that flips
// `acknowledgeRouteButton.disabled` / `skipRouteButton.disabled` to true
// and stamps the "route unset" segment into `#stateReadout`. The pre-seal
// DOM assertions below (`toBeDisabled`, `data-visible="false"`) then race
// the boot render on cold-start CI, failing intermittently even under
// retries: 3. Sibling `packet-intent-served-page-feel.spec.ts:46` uses
// the same `scene.ready === true` gate for the same reason — it's flipped
// at boot tail (aftersign/main.js:1689) IMMEDIATELY BEFORE the
// `renderText()` that populates the button state (line 1694), so waiting
// on it guarantees the DOM reflects the initial render before we assert.
async function waitForSceneReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game.scene.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForRouteMemory(page: Page, expected: "done" | "skipped"): Promise<void> {
  await page.waitForFunction(
    (value) => window.__game?.version === 1 && window.__game.player?.secondAction === value,
    expected,
    { timeout: WAIT_MS },
  );
}

// Attach page-error / console-error listeners so a module-import failure
// (esm.sh outage, three.js load error) surfaces in the test log + trace
// instead of hiding behind a mystery waitForFunction timeout.
function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

// Measures the wall-clock latency from dispatching a choice to the scene
// transitioning to the expected beat. This is what makes this test a
// responsiveness gate rather than a duplicate of memory-prior-session.spec.
async function measureChoiceLatency(
  page: Page,
  choiceId: PacketChoiceId,
  nextBeat: PacketBeat,
): Promise<number> {
  const started = Date.now();
  await page.evaluate((id) => {
    if (!window.__game) {
      throw new Error(`window.__game missing when dispatching ${id}`);
    }
    return window.__game.input.choose(id);
  }, choiceId);
  await waitForBeat(page, nextBeat);
  return Date.now() - started;
}

async function measureRouteChoiceLatency(
  page: Page,
  choiceId: "acknowledge-kiosk" | "skip-kiosk-acknowledge",
  expectedMemory: "done" | "skipped",
): Promise<number> {
  const started = Date.now();
  await page.evaluate((id) => {
    if (!window.__game) {
      throw new Error(`window.__game missing when dispatching ${id}`);
    }
    return window.__game.input.choose(id);
  }, choiceId);
  await waitForRouteMemory(page, expectedMemory);
  return Date.now() - started;
}

test("packet choice controls stay responsive through offer -> seal -> route memory -> deliver", async ({
  page,
}) => {
  // Same cold-start allowance as siblings — the responsiveness gate below
  // measures post-warmup latency, but getting to warmup takes real time.
  test.setTimeout(COLD_START_MS);
  watchPageErrors(page, "packet-choice-controls");

  await page.goto(`/aftersign/?slot=packet-choice-controls-${Date.now()}`, {
    waitUntil: "load",
  });

  // Warm-up: cold start absorbs the SwiftShader + three.js import cost.
  // Latency is NOT measured here — only from the first choice onward.
  await waitForBeat(page, "packet-offered");
  // Gate the DOM assertions on `scene.ready === true` (set at boot tail
  // immediately before the first `renderText()`); without this the
  // disabled/data-visible checks race the initial render on cold CI.
  await waitForSceneReady(page);

  await expect(page.locator(ROUTE_CHOICE_SELECTOR)).toHaveAttribute("data-visible", "false");
  await expect(page.locator(ACKNOWLEDGE_BUTTON_SELECTOR)).toBeDisabled();
  await expect(page.locator(SKIP_BUTTON_SELECTOR)).toBeDisabled();

  const sealLatency = await measureChoiceLatency(page, "keep-packet-sealed", "packet-choice");
  expect(
    sealLatency,
    `keep-packet-sealed took ${sealLatency}ms (budget ${CHOICE_RESPONSE_MS}ms)`,
  ).toBeLessThan(CHOICE_RESPONSE_MS);

  await expect(page.locator(ROUTE_CHOICE_SELECTOR)).toHaveAttribute("data-visible", "true");
  await expect(page.locator(ACKNOWLEDGE_BUTTON_SELECTOR)).toBeEnabled();
  await expect(page.locator(SKIP_BUTTON_SELECTOR)).toBeEnabled();

  const routeLatency = await measureRouteChoiceLatency(page, "acknowledge-kiosk", "done");
  expect(
    routeLatency,
    `acknowledge-kiosk took ${routeLatency}ms (budget ${CHOICE_RESPONSE_MS}ms)`,
  ).toBeLessThan(CHOICE_RESPONSE_MS);
  await expect(page.locator("#stateReadout")).toContainText("route listened");

  const deliverLatency = await measureChoiceLatency(page, "deliver-packet", "packet-delivered");
  expect(
    deliverLatency,
    `deliver-packet took ${deliverLatency}ms (budget ${CHOICE_RESPONSE_MS}ms)`,
  ).toBeLessThan(CHOICE_RESPONSE_MS);

  const deliveredBeat = await page.evaluate(() => window.__game?.scene.beat);
  expect(deliveredBeat).toBe("packet-delivered");
});
