import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN packet-cancel FAILURE STING — played, not driven.
//
// A real drift-cancel on the visible `#packetButton` (pointerdown →
// horizontal drag past DRIFT_CANCEL_PX → pointerup) must fire the pinned
// failure sting envelope. `window.__game` is read for state only; input is
// never caused through `__game.input.*`.
//
// Feel numbers mirror DEFAULT_FAILURE_STING_FEEL in the engine. The sting is
// a 180ms envelope: the runtime writes `--confirm-shake-x` / `--confirm-shake-y`
// from the live wobble and drives `.failure-sting` opacity from flashAlpha,
// and both decay back to 0 by t=180ms (main.js:3899-3904).
//
// TIMING DISCIPLINE (Soren, #1641-#1645, #1657):
//   • A single CDP snapshot is ~3 round-trips (~235ms on SwiftShader) past
//     sting start — past the envelope. So NOTHING here is sampled from the
//     Playwright side while the sting is live. An in-page rAF sampler,
//     installed BEFORE the gesture, accumulates the high-water mark of every
//     visual channel plus a clone of the feedback object taken while
//     `active === true` (the runtime mutates that object in place).
//   • The Playwright side only polls the accumulator for "fired AND decayed"
//     and then reads it once. No `waitForTimeout` anywhere — the decay is a
//     state signal, so the no-wall-clock-waits guard has nothing to allow.
//   • Fresh `?slot=` for save isolation, `/aftersign/` path (baseURL is
//     `http://localhost:4374/aftersign/`; a bare `/` would leave the app),
//     and the shared `scene.ready` gate before any gesture.

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

const FAILURE_STING_FEEL = {
  durationMs: 180,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  easing: "easeOutQuad",
};

// Past DRIFT_CANCEL_PX (14, strict `>`); same sweep the sibling gestures use.
const CANCEL_PULL_PX = 34;

type FeedbackSnapshot = {
  active: boolean;
  kind: string | undefined;
  durationMs: number | undefined;
  easing: string | undefined;
  hudShakePx: number | undefined;
  hudDropPx: number | undefined;
  flashAlpha: number | undefined;
};

type StingHighWater = {
  peakShakeXAbs: number;
  peakShakeY: number;
  peakFlashOpacity: number;
  sampleCount: number;
  liveFrames: number;
  everActive: boolean;
  everDecayed: boolean;
  lastLiveFeedback: FeedbackSnapshot | null;
  lastAction: string | null;
};

type GameWindow = Window & {
  __cancelStingHighWater?: StingHighWater;
  __cancelStingRafId?: number;
  __game?: {
    scene?: { ready?: boolean };
    interaction?: {
      lastAction?: string;
      failureFeedback?: {
        active?: boolean;
        kind?: string;
        durationMs?: number;
        easing?: string;
        hudShakePx?: number;
        hudDropPx?: number;
        flashAlpha?: number;
      };
    };
  };
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as GameWindow).__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function installStingHighWater(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as GameWindow;
    if (typeof w.__cancelStingRafId === "number") {
      cancelAnimationFrame(w.__cancelStingRafId);
    }
    const hw: StingHighWater = {
      peakShakeXAbs: 0,
      peakShakeY: 0,
      peakFlashOpacity: 0,
      sampleCount: 0,
      liveFrames: 0,
      everActive: false,
      everDecayed: false,
      lastLiveFeedback: null,
      lastAction: null,
    };
    w.__cancelStingHighWater = hw;
    const root = document.documentElement;
    const readPx = (name: string) =>
      Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
    const tick = () => {
      hw.sampleCount += 1;
      const feedback = w.__game?.interaction?.failureFeedback;
      const active = feedback?.active === true;
      hw.lastAction = w.__game?.interaction?.lastAction ?? null;
      if (active && feedback) {
        hw.everActive = true;
        hw.liveFrames += 1;
        // Clone while live — the runtime mutates this object in place.
        hw.lastLiveFeedback = {
          active,
          kind: feedback.kind,
          durationMs: feedback.durationMs,
          easing: feedback.easing,
          hudShakePx: feedback.hudShakePx,
          hudDropPx: feedback.hudDropPx,
          flashAlpha: feedback.flashAlpha,
        };
        const shakeXAbs = Math.abs(readPx("--confirm-shake-x"));
        const shakeY = readPx("--confirm-shake-y");
        const sting = document.querySelector<HTMLElement>(".failure-sting");
        const opacity = sting
          ? Number.parseFloat(getComputedStyle(sting).opacity) || 0
          : 0;
        if (shakeXAbs > hw.peakShakeXAbs) hw.peakShakeXAbs = shakeXAbs;
        if (shakeY > hw.peakShakeY) hw.peakShakeY = shakeY;
        if (opacity > hw.peakFlashOpacity) hw.peakFlashOpacity = opacity;
      } else if (hw.everActive) {
        hw.everDecayed = true;
      }
      w.__cancelStingRafId = requestAnimationFrame(tick);
    };
    w.__cancelStingRafId = requestAnimationFrame(tick);
  });
}

async function readStingHighWater(page: Page): Promise<StingHighWater> {
  return page.evaluate(() => {
    const w = window as unknown as GameWindow;
    if (!w.__cancelStingHighWater) {
      throw new Error("cancel sting high-water sampler was not installed");
    }
    // One atomic read: the whole accumulator (state clone + peaks) in a
    // single evaluate, so nothing here can straddle an rAF tick.
    return { ...w.__cancelStingHighWater };
  });
}

test.describe("AFTERSIGN packet cancel failure sting", () => {
  test("a played packet-cancel gesture produces the pinned failure sting envelope", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `packet-cancel-failure-sting-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

    // Sampler must be looping BEFORE the first drag frame crosses
    // DRIFT_CANCEL_PX — the sting fires during pointermove, so a large
    // chunk of the 180ms envelope elapses inside the gesture itself.
    await installStingHighWater(page);

    const buttonBox = await packetButton.boundingBox();
    expect(buttonBox, "#packetButton has a rendered hit target").not.toBeNull();
    const startX = buttonBox!.x + buttonBox!.width / 2;
    const startY = buttonBox!.y + buttonBox!.height / 2;

    // Real page.mouse events on the visible button — a genuine
    // player-caused drift-cancel, not a driven `__game.input.*` poke.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + CANCEL_PULL_PX, startY, { steps: 5 });
    await page.mouse.up();

    // Gate on the accumulator, not on a live `active` read: by the time a
    // CDP round-trip lands, the envelope may already be over. "fired AND
    // decayed" is a monotonic state signal, so no wall-clock wait is needed.
    await expect
      .poll(
        async () => {
          const hw = await readStingHighWater(page);
          return (
            hw.lastAction === "packet-cancelled" &&
            hw.everActive === true &&
            hw.everDecayed === true
          );
        },
        { message: "failure sting fires and then releases", timeout: WAIT_MS },
      )
      .toBe(true);

    const hw = await readStingHighWater(page);

    // Shape contract — feel constants match DEFAULT_FAILURE_STING_FEEL
    // verbatim; `kind` is the field main.js:3099 actually writes.
    expect(hw.lastLiveFeedback).toMatchObject({
      active: true,
      kind: "packet-cancelled",
      ...FAILURE_STING_FEEL,
    });

    // Envelope contract — it lit, it decayed, and the render pump was
    // observed at least once while it was live.
    expect(hw.everActive).toBe(true);
    expect(hw.everDecayed).toBe(true);
    expect(hw.liveFrames).toBeGreaterThanOrEqual(1);

    // Visual contract — the sting reached the DOM. On a throttled
    // SwiftShader pump a 180ms window can yield very few frames and the
    // wobble term snaps sub-integer values to 0px via Math.round, so we
    // require at least ONE visual channel to have registered rather than
    // pinning a specific frame's value, and we bound every channel by its
    // feel ceiling.
    expect(
      hw.peakShakeXAbs > 0 || hw.peakFlashOpacity > 0,
      `expected a rendered sting channel; got shakeX=${hw.peakShakeXAbs} flash=${hw.peakFlashOpacity} over ${hw.liveFrames} live frames`,
    ).toBe(true);
    expect(hw.peakShakeXAbs).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudShakePx);
    expect(hw.peakShakeY).toBeGreaterThanOrEqual(0);
    expect(hw.peakShakeY).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudDropPx);
    expect(hw.peakFlashOpacity).toBeLessThanOrEqual(FAILURE_STING_FEEL.flashAlpha);

    // Post-decay: the controller released the sting (not wedged active).
    const settled = await page.evaluate(
      () =>
        (window as unknown as GameWindow).__game?.interaction?.failureFeedback
          ?.active ?? false,
    );
    expect(settled).toBe(false);
  });
});
