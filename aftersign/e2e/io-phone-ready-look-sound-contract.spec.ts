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
 *   4. Every measurement is polled off runtime state (rAF-driven game
 *      clock + engine bookkeeping), never off wall-clock timeouts — so
 *      CI can't flake on a slow runner.
 *
 * IMPORTANT: publishState() in index.html reassigns window.__game to a
 * fresh object on every markStateDirty() tick. A `const game = window.__game`
 * captured once inside page.evaluate is a STALE CLONE — its fields never
 * update. Every observation below re-reads window.__game per frame.
 *
 * Story-flow parity: this spec mirrors io-recognition-feedback-latency.spec.ts
 * for the sequence that reaches io-returning-recognition. That path is the
 * ONLY one shipped code exposes — there is no top-level deliverPacket() on
 * window.__game, only input.choose("deliver-packet"). An earlier revision of
 * this spec called a non-existent __game.deliverPacket and always timed out.
 */

// Phone envelope. iPhone 12 / 13 / 14 base viewport (390x844) is the
// smallest realistic modern phone width we ship for; anything readable
// here reads on 393/402/430-wide phones too.
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
  deviceScaleFactor: 3,
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

type PhoneMeasurement = {
  line: {
    text: string;
    boxLeft: number;
    boxTop: number;
    boxRight: number;
    boxBottom: number;
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
  };
  viewport: { width: number; height: number };
  uiSettleMs: number;
  avDriftMs: number;
  audioUnlocked: boolean;
  lastAudioCue: string | null;
  confirmStartedAt: number;
  audioCueAt: number;
  beat: Beat;
};

test("phone-ready recognition beat fits its layout and A/V budget", async ({ page }) => {
  // Cold-start allowance — matches every sibling spec in this directory.
  // Without this the whole test runs under Playwright's default 30s, which
  // SwiftShader + esm.sh three.js reliably overshoot on CI.
  test.setTimeout(COLD_START_MS);

  const slot = `io-phone-ready-contract-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  // Wait for the full surface we need. Includes `audio` and `enableAudio` —
  // the observable handles for the A/V drift measurement. `{ timeout: WAIT_MS }`
  // gives this observation the same 60s cold-start budget every sibling spec
  // passes to waitForFunction.
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
  // cue that fires inside deliverPacket will complete synchronously with
  // the visual confirm pulse — otherwise its `await enableAudio()` would
  // race the confirm animation.
  const audioUnlocked = await page.evaluate(() => window.__game!.enableAudio());

  // Keep the packet sealed, then measure the confirm feedback timing that
  // fires when the player chooses "deliver-packet". That choose is what
  // calls triggerKioskFeedback() (sets confirmStartedAt) and playKioskConfirm()
  // (sets audio.lastCue = "packet-confirmed" + lastCueAt in the same
  // synchronous mutation). Both timestamps are what we measure against.
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await page.waitForFunction(
    () => window.__game?.scene.beat === "packet-kept-sealed",
    undefined,
    { timeout: WAIT_MS },
  );

  // Drive the delivery + measure confirm feedback timing inside the page,
  // so no Playwright RPC hop lands between the trigger and the observation.
  const feedbackTiming = await page.evaluate(async ({ maxUiSettleMs }) => {
    const getGame = () => window.__game!;

    // Fire the deliver choose UNAWAITED so we can catch confirmStartedAt
    // the moment it flips non-null. deliverPacket() awaits enableAudio()
    // and does its own bookkeeping — if we awaited its promise first, the
    // confirmStartedAt→null reset could beat our first observation.
    const deliverPromise = getGame().input.choose("deliver-packet");

    // Latch confirmStartedAt as soon as it appears. The tick loop nulls
    // it once confirmProgress reaches 1, so this MUST be captured first.
    let capturedConfirmStartedAt: number | null = null;
    await new Promise<void>((resolve, reject) => {
      const captureDeadline = maxUiSettleMs * 2;
      const startedAt = performance.now();
      const tick = () => {
        const started = getGame().interaction.confirmStartedAt;
        if (typeof started === "number") {
          capturedConfirmStartedAt = started;
          resolve();
          return;
        }
        if (performance.now() - startedAt > captureDeadline) {
          reject(new Error(
            `confirmStartedAt never became non-null within ${captureDeadline}ms after deliver-packet choose — ` +
              `triggerKioskFeedback may not be running`,
          ));
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Wait for BOTH the audio cue AND the visual settle to finish. Visual
    // settle is "confirmFeedback.active === false && remainingMs === 0" —
    // we do NOT gate on confirmStartedAt because the tick nulls it on
    // completion. Audio done is "audio.lastCue === 'packet-confirmed'
    // && typeof lastCueAt === 'number'", read fresh per frame off the
    // republished snapshot. RAF loop only; no wall-clock waits.
    const startWaitAt = performance.now();
    let capturedAudioCueAt: number | null = null;
    await new Promise<void>((resolve, reject) => {
      const settleDeadline = maxUiSettleMs * 4;
      const tick = () => {
        const now = performance.now();
        const game = getGame();
        const feedback = game.interaction.confirmFeedback;
        const visualDone = feedback.active === false && feedback.remainingMs === 0;
        const audio = game.audio;
        const audioDone = audio?.lastCue === "packet-confirmed"
          && typeof audio?.lastCueAt === "number";
        if (audioDone && capturedAudioCueAt === null) {
          capturedAudioCueAt = audio.lastCueAt as number;
        }
        if (visualDone && audioDone) {
          resolve();
          return;
        }
        if (now - startWaitAt > settleDeadline) {
          reject(new Error(
            `phone-ready wait exceeded ${settleDeadline}ms — ` +
              `visualDone=${visualDone} audioDone=${audioDone} ` +
              `lastCue=${String(audio?.lastCue)} lastCueAt=${String(audio?.lastCueAt)} ` +
              `feedback.active=${feedback.active} feedback.remainingMs=${feedback.remainingMs}`,
          ));
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Now let the deliver choose finish so downstream steps see stable state.
    await deliverPromise;

    const confirmStartedAt = capturedConfirmStartedAt as number;
    const audioCueAt = capturedAudioCueAt as number;
    return {
      confirmStartedAt,
      audioCueAt,
      uiSettleMs: performance.now() - confirmStartedAt,
      avDriftMs: Math.abs(audioCueAt - confirmStartedAt),
      lastAudioCue: getGame().audio.lastCue,
    };
  }, { maxUiSettleMs: MAX_UI_SETTLE_MS });

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

  // After reload the audio surface may be reset; re-unlock so downstream
  // code paths behave the same for the returning-session player.
  await page.evaluate(() => window.__game!.enableAudio());

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

  const measurement: PhoneMeasurement = {
    line: layout.line,
    viewport: layout.viewport,
    uiSettleMs: feedbackTiming.uiSettleMs,
    avDriftMs: feedbackTiming.avDriftMs,
    audioUnlocked,
    lastAudioCue: feedbackTiming.lastAudioCue,
    confirmStartedAt: feedbackTiming.confirmStartedAt,
    audioCueAt: feedbackTiming.audioCueAt,
    beat: layout.beat as Beat,
  };

  // ---- Assertions on real measurements ---------------------------------

  // Viewport is the phone we asked for.
  expect(measurement.viewport.width).toBe(PHONE_VIEWPORT.width);

  // Beat actually reached returning-recognition (otherwise we're measuring
  // the wrong line).
  expect(measurement.beat).toBe("io-returning-recognition");

  // (Acceptance criterion 1) recognition line is visible and readable at
  // phone width — no horizontal overflow, no off-screen clipping.
  expect(measurement.line.text.length).toBeGreaterThan(0);
  expect(measurement.line.text).toContain("blue seal, unbroken");
  // Horizontal overflow: scrollWidth exceeding clientWidth means text is
  // clipped horizontally. Allow a 1px slack for sub-pixel rounding.
  expect(measurement.line.scrollWidth).toBeLessThanOrEqual(measurement.line.clientWidth + 1);
  // Vertical overflow inside the block: text height must fit its box.
  expect(measurement.line.scrollHeight).toBeLessThanOrEqual(measurement.line.clientHeight + 1);
  // Bounding box must fall inside the phone viewport on both axes.
  expect(measurement.line.boxLeft).toBeGreaterThanOrEqual(0);
  expect(measurement.line.boxTop).toBeGreaterThanOrEqual(0);
  expect(measurement.line.boxRight).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
  expect(measurement.line.boxBottom).toBeLessThanOrEqual(PHONE_VIEWPORT.height);

  // (Acceptance criterion 2) UI settle <= 360ms from the recognition trigger.
  expect(measurement.uiSettleMs).toBeGreaterThan(0);
  expect(measurement.uiSettleMs).toBeLessThanOrEqual(MAX_UI_SETTLE_MS);

  // (Acceptance criterion 3) audio/visual coupling drift <= 50ms. We
  // required audio to actually unlock — if it didn't, the message says so
  // and we fail here rather than silently skipping (that would recreate the
  // "static envelope only" state #544 asks to fix).
  expect(
    measurement.audioUnlocked,
    `AudioContext failed to unlock (lastCue=${String(measurement.lastAudioCue)}). ` +
      `Verify --autoplay-policy=no-user-gesture-required is set in playwright.config.ts.`,
  ).toBe(true);
  expect(measurement.lastAudioCue).toBe("packet-confirmed");
  expect(measurement.avDriftMs).toBeLessThanOrEqual(MAX_AV_DRIFT_MS);
});
