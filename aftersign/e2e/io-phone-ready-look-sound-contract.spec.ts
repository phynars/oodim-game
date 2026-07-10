import { expect, test } from "@playwright/test";

/**
 * AFTERSIGN phone-ready look/sound envelope for Io's first memory beat.
 *
 * This is a RUNTIME-BOUND contract harness (not a static-envelope check):
 * it loads /aftersign/ at a phone viewport, drives the same story path a
 * returning player takes (offer → keep sealed → deliver → save → reload →
 * advance → recognition), and measures real behavior against #544's four
 * budgets:
 *
 *   1. The Io sealed-packet recognition line fits inside the phone HUD
 *      (no horizontal overflow, no off-screen clipping).
 *   2. UI settle (visual confirm pulse) completes <= 360ms from the
 *      recognition trigger (the deliver-packet choose that fires
 *      triggerKioskFeedback + playKioskConfirm).
 *   3. Audio/visual coupling drift for the paired confirm cue is <= 50ms.
 *   4. Every measurement is an ENGINE-STAMPED timestamp (confirmStartedAt,
 *      confirmSettledAt, audio.lastCueAt — all performance.now()/rAF clock
 *      values written by index.html itself), never a wall-clock observation
 *      by this spec — so CI runner speed cannot skew the numbers.
 *
 * MEASUREMENT DESIGN (why there is no rAF polling loop in here):
 *
 * An earlier revision fired `choose("deliver-packet")` unawaited and then
 * polled window.__game from a requestAnimationFrame loop, trying to latch
 * `interaction.confirmStartedAt` before the game's tick nulls it (the tick
 * clears it once the 220ms pulse completes). That is a race by construction:
 * the game's own tick is registered EARLIER in the rAF queue, so on any
 * frame that lands >220ms after the trigger (routine under SwiftShader with
 * parallel workers), the tick nulls the field before the spec's callback
 * runs — the latch never fires and the spec times out.
 *
 * The race is unnecessary. deliverPacket() in index.html is synchronous up
 * to and including both stamps: triggerKioskFeedback() sets
 * interaction.confirmStartedAt and playKioskConfirm() sets audio.lastCue +
 * audio.lastCueAt BEFORE its first `await`, and each publishes a fresh
 * window.__game snapshot synchronously. So a single page.evaluate task that
 * calls choose() and immediately re-reads window.__game captures both
 * stamps with NOTHING able to interleave — JS is single-threaded and no
 * rAF callback can run mid-task.
 *
 * For the settle end-point, the engine itself stamps
 * interaction.confirmSettledAt (the rAF frame timestamp at which
 * confirmProgress reached 1) when it nulls confirmStartedAt. The spec
 * waits for that stamp with waitForFunction and computes
 * uiSettleMs = confirmSettledAt - confirmStartedAt — both numbers written
 * by the engine on the same performance.now() timeline, so the spec's own
 * observation latency contributes zero.
 *
 * IMPORTANT: publishState() in index.html reassigns window.__game to a
 * fresh object on every markStateDirty() tick. A `const game = window.__game`
 * captured once is a STALE CLONE — its fields never update. Every
 * observation below re-reads window.__game.
 */

// Phone envelope. iPhone 12 / 13 / 14 base viewport (390x844) is the
// smallest realistic modern phone width we ship for; anything readable
// here reads on 393/402/430-wide phones too.
//
// deviceScaleFactor stays at 1 (not the physical device's 3): every layout
// assertion below is in CSS pixels, which are DSF-invariant, while a DSF of
// 3 would make index.html render the WebGL canvas at pixelRatio 2 (it clamps
// min(dpr, 2)) — ~4x the fragment work through the bloom composer on
// SwiftShader, starving the very rAF pipeline whose settle latency we're
// certifying. Measuring the engine under artificial 4x load is not the
// phone contract; DSF 1 keeps the canvas cost identical to the sibling
// specs that share this CI runner.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const MAX_UI_SETTLE_MS = 360;
const MAX_AV_DRIFT_MS = 50;

// AFTERSIGN cold-start allowance. SwiftShader + esm.sh three.js on the CI
// runner routinely need >30s (Playwright's default) just to reach the point
// where window.__game is published. Every sibling spec in this directory
// carries the same 90s / 60s pair — see io-recognition-feedback-latency.spec.ts.
const COLD_START_MS = 90_000;
// Per-wait budget for any single window.__game observation.
const WAIT_MS = 60_000;

test.use({
  viewport: PHONE_VIEWPORT,
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  interaction: {
    confirmStartedAt: number | null;
    confirmSettledAt: number | null;
    confirmFeedback: { active: boolean; remainingMs: number };
  };
  audio: {
    unlocked: boolean;
    lastCue: string | null;
    lastCueAt: number | null;
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(
      choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet",
    ): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
  enableAudio: () => Promise<boolean>;
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

test("phone-ready recognition beat fits its layout and A/V budget", async ({ page }) => {
  // Cold-start allowance — matches every sibling spec in this directory.
  test.setTimeout(COLD_START_MS);

  const slot = `io-phone-ready-contract-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  // Wait for the full surface we need. Includes `audio` and `enableAudio` —
  // the observable handles for the A/V drift measurement.
  await page.waitForFunction(() => {
    const game = window.__game;
    return Boolean(
      game
        && game.version === 1
        && game.input?.choose
        && game.input?.advance
        && game.input?.forceSave
        && game.input?.forceReload
        && game.enableAudio
        && game.audio,
    );
  }, undefined, { timeout: WAIT_MS });

  // Wait until we're at packet-offered — the story's first branch point.
  await page.waitForFunction(
    () => window.__game?.scene.beat === "packet-offered",
    undefined,
    { timeout: WAIT_MS },
  );

  // Unlock audio BEFORE we drive the story. In CI Chromium this succeeds
  // because playwright.config.ts passes --autoplay-policy=no-user-gesture-required.
  // Doing it here (before the deliver choose) means the "packet-confirmed"
  // cue that fires inside deliverPacket completes without its internal
  // `await enableAudio()` needing to unlock mid-flight.
  const audioUnlocked = await page.evaluate(() => window.__game!.enableAudio());

  // Keep the packet sealed — the branch whose recognition line we certify.
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await page.waitForFunction(
    () => window.__game?.scene.beat === "packet-kept-sealed",
    undefined,
    { timeout: WAIT_MS },
  );

  // Fire the deliver choose and capture BOTH engine stamps in the SAME JS
  // task. choose("deliver-packet") runs deliverPacket() synchronously:
  // triggerKioskFeedback() publishes confirmStartedAt and playKioskConfirm()
  // publishes audio.lastCue/lastCueAt before its first await — so re-reading
  // window.__game right after the call sees both, race-free (no rAF callback
  // can interleave inside a single task).
  const trigger = await page.evaluate(async () => {
    const deliverPromise = window.__game!.input.choose("deliver-packet");
    const snapshot = window.__game!;
    const confirmStartedAt = snapshot.interaction.confirmStartedAt;
    const audioCueAt = snapshot.audio.lastCueAt;
    const lastAudioCue = snapshot.audio.lastCue;
    await deliverPromise;
    if (typeof confirmStartedAt !== "number") {
      throw new Error(
        "confirmStartedAt was not set synchronously by deliver-packet — "
          + "triggerKioskFeedback may not be running",
      );
    }
    if (typeof audioCueAt !== "number") {
      throw new Error(
        `audio.lastCueAt was not set synchronously by deliver-packet `
          + `(lastCue=${String(lastAudioCue)}) — playKioskConfirm may not be stamping at source`,
      );
    }
    return { confirmStartedAt, audioCueAt, lastAudioCue };
  });

  // Wait for the engine to stamp the settle end-point. The tick loop writes
  // interaction.confirmSettledAt (its own rAF frame timestamp) in the frame
  // where confirmProgress reaches 1, and publishes the transition. This is
  // a state wait with the standard cold-start budget — the DURATION we
  // assert on comes from the two engine stamps, not from how long this
  // waitForFunction took to notice.
  const settledAtHandle = await page.waitForFunction(
    () => {
      const game = window.__game;
      return game
        && game.interaction.confirmFeedback.active === false
        && typeof game.interaction.confirmSettledAt === "number"
        ? game.interaction.confirmSettledAt
        : null;
    },
    undefined,
    { timeout: WAIT_MS },
  );
  const confirmSettledAt = (await settledAtHandle.jsonValue()) as number;

  const uiSettleMs = confirmSettledAt - trigger.confirmStartedAt;
  const avDriftMs = Math.abs(trigger.audioCueAt - trigger.confirmStartedAt);

  // Reach packet-delivered, then persist + reload to enter the returning
  // session where advance() lands on io-returning-recognition. This is the
  // proven story flow from io-recognition-feedback-latency.spec.ts.
  await page.waitForFunction(
    () => window.__game?.scene.beat === "packet-delivered",
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(
    () => window.__game?.save.dirty === false,
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game!.input.forceReload());

  // Advance into the recognition beat.
  await page.evaluate(() => window.__game!.input.advance());
  await page.waitForFunction(
    () => window.__game?.scene.beat === "io-returning-recognition",
    undefined,
    { timeout: WAIT_MS },
  );

  // Inspect Io's sealed-packet line in the actual DOM at phone width.
  const layout = await page.evaluate(() => {
    const line = document.querySelector<HTMLElement>("#line");
    if (!line) throw new Error("recognition line element (#line) is missing");
    const rect = line.getBoundingClientRect();
    return {
      line: {
        text: (line.textContent ?? "").trim(),
        boxLeft: rect.left,
        boxTop: rect.top,
        boxRight: rect.right,
        boxBottom: rect.bottom,
        scrollWidth: line.scrollWidth,
        clientWidth: line.clientWidth,
        scrollHeight: line.scrollHeight,
        clientHeight: line.clientHeight,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      beat: window.__game!.scene.beat,
    };
  });

  // ---- Assertions on real measurements ---------------------------------

  // Viewport is the phone we asked for.
  expect(layout.viewport.width).toBe(PHONE_VIEWPORT.width);

  // Beat actually reached returning-recognition (otherwise we're measuring
  // the wrong line).
  expect(layout.beat).toBe("io-returning-recognition");

  // (Acceptance criterion 1) recognition line is visible and readable at
  // phone width — no horizontal overflow, no off-screen clipping.
  expect(layout.line.text.length).toBeGreaterThan(0);
  expect(layout.line.text).toContain("blue seal, unbroken");
  // Horizontal overflow: scrollWidth exceeding clientWidth means text is
  // clipped horizontally. Allow a 1px slack for sub-pixel rounding.
  expect(layout.line.scrollWidth).toBeLessThanOrEqual(layout.line.clientWidth + 1);
  // Vertical overflow inside the block: text height must fit its box.
  expect(layout.line.scrollHeight).toBeLessThanOrEqual(layout.line.clientHeight + 1);
  // Bounding box must fall inside the phone viewport on both axes.
  expect(layout.line.boxLeft).toBeGreaterThanOrEqual(0);
  expect(layout.line.boxTop).toBeGreaterThanOrEqual(0);
  expect(layout.line.boxRight).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
  expect(layout.line.boxBottom).toBeLessThanOrEqual(PHONE_VIEWPORT.height);

  // (Acceptance criterion 2) UI settle <= 360ms from the recognition
  // trigger. Both endpoints are engine stamps on the same performance.now()
  // timeline: confirmStartedAt written by triggerKioskFeedback, and
  // confirmSettledAt written by the tick in the frame the pulse completed.
  // The engine's pulse duration is 220ms (CONFIRM_FEEDBACK.durationMs), so
  // the 360ms budget leaves ~140ms of frame-granularity headroom — a real
  // regression (longer pulse, promise-gated settle) still trips it.
  expect(uiSettleMs).toBeGreaterThan(0);
  expect(uiSettleMs).toBeLessThanOrEqual(MAX_UI_SETTLE_MS);

  // (Acceptance criterion 3) audio/visual coupling drift <= 50ms, measured
  // as |audio.lastCueAt - confirmStartedAt| — both stamped synchronously at
  // the source inside deliverPacket(). We require audio to actually unlock —
  // if it didn't, the message says so and we fail here rather than silently
  // skipping (that would recreate the "static envelope only" state #544
  // asks to fix).
  expect(
    audioUnlocked,
    `AudioContext failed to unlock (lastCue=${String(trigger.lastAudioCue)}). `
      + `Verify --autoplay-policy=no-user-gesture-required is set in playwright.config.ts.`,
  ).toBe(true);
  expect(trigger.lastAudioCue).toBe("packet-confirmed");
  expect(avDriftMs).toBeLessThanOrEqual(MAX_AV_DRIFT_MS);
});
