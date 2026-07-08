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

type PacketBeat = "packet-offered" | "packet-kept-sealed" | "packet-delivered";

type PacketChoiceId = "keep-packet-sealed" | "deliver-packet";

type GameSurface = {
  version: 1;
  scene: { beat: PacketBeat };
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

test("packet choice controls stay responsive through offer -> seal -> deliver", async ({
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

  const sealLatency = await measureChoiceLatency(page, "keep-packet-sealed", "packet-kept-sealed");
  expect(
    sealLatency,
    `keep-packet-sealed took ${sealLatency}ms (budget ${CHOICE_RESPONSE_MS}ms)`,
  ).toBeLessThan(CHOICE_RESPONSE_MS);

  const deliverLatency = await measureChoiceLatency(page, "deliver-packet", "packet-delivered");
  expect(
    deliverLatency,
    `deliver-packet took ${deliverLatency}ms (budget ${CHOICE_RESPONSE_MS}ms)`,
  ).toBeLessThan(CHOICE_RESPONSE_MS);

  const deliveredBeat = await page.evaluate(() => window.__game?.scene.beat);
  expect(deliveredBeat).toBe("packet-delivered");
});
