import { expect, test } from "@playwright/test";

/**
 * AFTERSIGN phone-ready look/sound envelope for Io's first memory beat.
 *
 * This is a RUNTIME-BOUND contract harness (not a static-envelope check):
 * it loads /aftersign/index.html at a phone viewport, drives the same
 * deliverPacket() code path a player would, and measures real behavior
 * against #544's four budgets:
 *
 *   1. The Io sealed-packet recognition line fits inside the phone HUD
 *      (no horizontal overflow, no off-screen clipping).
 *   2. UI settle (visual confirm pulse) completes <= 360ms from the
 *      recognition trigger.
 *   3. Audio/visual coupling drift for the paired confirm cue is <= 50ms.
 *   4. Every measurement is polled off runtime state (rAF-driven game
 *      clock + engine bookkeeping), never off wall-clock timeouts — so
 *      CI can't flake on a slow runner.
 */

// Phone envelope. iPhone 12 / 13 / 14 base viewport (390x844) is the
// smallest realistic modern phone width we ship for; anything readable
// here reads on 393/402/430-wide phones too.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const MAX_UI_SETTLE_MS = 360;
const MAX_AV_DRIFT_MS = 50;

test.use({
  viewport: PHONE_VIEWPORT,
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

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
  beat: string;
};

test("phone-ready recognition beat fits its layout and A/V budget", async ({ page }) => {
  await page.goto("/aftersign/index.html?slot=phone-ready-contract");

  // Wait for the game surface + the recognition beat runtime (deliver /
  // enableAudio) to be published. This is polling on state, not clock time.
  await page.waitForFunction(() => {
    const game = (window as unknown as { __game?: { input?: { advance?: unknown }; enableAudio?: unknown; deliverPacket?: unknown } }).__game;
    return Boolean(game?.input?.advance && game.enableAudio && game.deliverPacket);
  });

  // Reset to a known slot state (packet-offered, sealed) so we drive the
  // sealed branch of Io's returning-recognition line deterministically.
  await page.evaluate(() => {
    (window as unknown as { __game: { resetSliceSave: () => void } }).__game.resetSliceSave();
  });

  const measurement = await page.evaluate(async ({ maxUiSettleMs }) => {
    type GameRuntime = {
      scene: { beat: string };
      interaction: {
        confirmStartedAt: number | null;
        confirmFeedback: { active: boolean; remainingMs: number };
      };
      _runtime?: { audio?: { unlocked: boolean; lastCue: string | null } };
      input: { advance: () => Promise<void> };
      enableAudio: () => Promise<boolean>;
      deliverPacket: () => Promise<void>;
      getSnapshot: () => {
        scene: { beat: string };
        interaction: { confirmStartedAt: number | null; confirmFeedback: { active: boolean; remainingMs: number } };
      };
    };
    const game = (window as unknown as { __game: GameRuntime }).__game;

    // 1. Unlock audio BEFORE delivery so the packet-confirmed cue can fire.
    //    In CI Chromium this succeeds because playwright.config.ts passes
    //    --autoplay-policy=no-user-gesture-required.
    const audioUnlocked = await game.enableAudio();

    // 2. Sample the runtime clock for the audio-cue transition via rAF —
    //    we watch state._runtime.audio.lastCue flipping to "packet-confirmed".
    //    Kick off the observer BEFORE deliverPacket so we don't miss the
    //    transition (deliverPacket calls playKioskConfirm synchronously; the
    //    audio scheduling awaits enableAudio which resolves next microtask).
    let audioCueAt: number | null = null;
    const watchAudioCue = () => {
      const cue = game._runtime?.audio?.lastCue;
      if (cue === "packet-confirmed" && audioCueAt === null) {
        audioCueAt = performance.now();
        return;
      }
      requestAnimationFrame(watchAudioCue);
    };
    requestAnimationFrame(watchAudioCue);

    // 3. Trigger the recognition beat.
    await game.deliverPacket();

    // 4. Wait for BOTH the audio cue AND the visual settle to finish, and
    //    record when they happened relative to confirmStartedAt. This uses
    //    the RAF loop only — no page.waitForTimeout, no wall-clock polling —
    //    so a slow CI runner shifts the whole timeline together and doesn't
    //    corrupt measured deltas. We cap the wait by (a) frame-count budget
    //    for the visual (settle duration is <=220ms per CONFIRM_FEEDBACK, we
    //    give ~2x headroom) and (b) audio-cue arrival (must occur; if the
    //    autoplay policy isn't wired we intentionally fail here rather than
    //    fall back to a tautology).
    const startWaitAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const settleDeadline = maxUiSettleMs * 4; // ms cap by frames, generous
      const tick = () => {
        const now = performance.now();
        const feedback = game.interaction.confirmFeedback;
        const visualDone = feedback.active === false && feedback.remainingMs === 0
          && game.interaction.confirmStartedAt !== null;
        const audioDone = audioCueAt !== null;
        if (visualDone && audioDone) {
          resolve();
          return;
        }
        if (now - startWaitAt > settleDeadline) {
          reject(new Error(
            `phone-ready wait exceeded ${settleDeadline}ms — visualDone=${visualDone} audioDone=${audioDone} lastCue=${String(game._runtime?.audio?.lastCue)}`,
          ));
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const confirmStartedAt = game.interaction.confirmStartedAt as number;
    const uiSettleMs = performance.now() - confirmStartedAt;
    const avDriftMs = Math.abs((audioCueAt as number) - confirmStartedAt);

    // 5. Advance to the returning-recognition beat so we can inspect Io's
    //    sealed-packet line in the actual DOM at phone width.
    await game.input.advance();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (game.scene.beat === "io-returning-recognition") {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

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
      uiSettleMs,
      avDriftMs,
      audioUnlocked,
      lastAudioCue: game._runtime?.audio?.lastCue ?? null,
      confirmStartedAt,
      audioCueAt: audioCueAt as number,
      beat: game.scene.beat,
    } satisfies PhoneMeasurement;
  }, { maxUiSettleMs: MAX_UI_SETTLE_MS });

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
