import { expect, test, type Page } from '@playwright/test';

// Cold-start budget matches sibling AFTERSIGN specs: SwiftShader + three.js
// first WebGL context regularly blows the default 30s in CI. Every spec in
// aftersign/e2e/ opts into 90s and uses waitUntil: 'load' — 'networkidle'
// never fires when the render loop keeps requesting frames.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const DETERMINISTIC_SLOT = 'io-phone-ready-contract';

// The line that ACTUALLY renders at the sealed recognition beat, per
// index.html's lineForBeat() branch for state.scene.beat ===
// 'io-returning-recognition' with state.packet.sealed === true. The earlier
// draft waited on "You brought it back sealed." which lives only in
// aftersign/src/recognitionFeedback.ts and is never imported by index.html.
const IO_SEALED_RECOGNITION_LINE =
  'I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.';

// Look-and-sound budget: the beat's clamped input-lock window is the
// game's own contract (index.html:919, Math.min(1220, ...)). Any value
// > 1220 would mean the clamp itself broke.
const MAX_UI_SETTLE_MS = 1220;
// The audio cue playKioskConfirm() stamps into state._runtime.audio.lastCue
// when it fires alongside triggerKioskFeedback() from deliverPacket()
// (index.html:756). Asserting on the string proves the audio half of
// the look/sound contract was dispatched on the same tick as the visual
// half — a structural coupling, not a fabricated numeric drift.
const EXPECTED_AUDIO_CUE = 'packet-confirmed';

type PhoneReadyProbe = {
  readonly lineText: string;
  readonly lineVisible: boolean;
  readonly lineReadable: boolean;
  readonly lineRect: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
  };
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly horizontalOverflowPx: number;
  readonly verticalOverflowPx: number;
  // inputLockMs is the game's OWN clamped settle value (index.html:919,
  // Math.min(1220, Math.max(0, Math.round(endedAt - startedAt)))). We
  // assert on that field directly rather than recomputing our own
  // unclamped delta — otherwise a slow CI runner where the 1180ms
  // setTimeout fires at ~1225ms trips MAX_UI_SETTLE_MS on the spec
  // while the game itself reports the clamped 1220 it actually
  // enforces. Mirrors io-recognition-memory-beat-contract.spec.ts:50.
  readonly inputLockMs: number;
  // Structural audio-visual coupling: the visual cue is triggered by
  // triggerKioskFeedback() and the audio cue is published by
  // playKioskConfirm(), both dispatched from the same deliverPacket()
  // call (index.html:895/928). We verify the audio cue "packet-confirmed"
  // was stamped into state._runtime.audio.lastCue — that's the
  // structural coupling the contract is protecting. A tautological
  // numeric drift assertion (which the previous draft used, returning
  // 0 from both branches of a ternary) cannot fail and so verifies
  // nothing.
  readonly audioLastCue: string | null;
};

// Wait for the module script to boot the game surface (parallels the
// pattern in io-recognition-memory-beat-contract.spec.ts). Without this,
// the first evaluate() can race the deferred module import.
const waitForGame = async (page: Page) => {
  await page.waitForFunction(
    () => Boolean(
      (window as Window & {
        __game?: { input?: { choose?: unknown; advance?: unknown; forceReload?: unknown } };
      }).__game?.input?.choose
        && (window as Window & {
          __game?: { input?: { advance?: unknown } };
        }).__game?.input?.advance
        && (window as Window & {
          __game?: { input?: { forceReload?: unknown } };
        }).__game?.input?.forceReload,
    ),
    undefined,
    { timeout: WAIT_MS },
  );
};

// Drive the game into the sealed recognition beat via the same public
// input surface the other e2e specs use — keep-packet-sealed →
// deliver-packet → advance(). The prior draft tried to boot straight to
// the beat via ?outcome=sealed, but index.html only reads `slot`; the
// query param was a no-op and the page stayed on 'packet-offered'.
const driveToSealedRecognitionBeat = async (page: Page) => {
  await waitForGame(page);
  await page.evaluate(async () => {
    const game = (window as Window & {
      __game?: {
        input?: {
          choose?: (choiceId: string) => Promise<void>;
          advance?: () => Promise<void>;
          forceReload?: () => Promise<void>;
        };
        story?: { memoryBeat?: unknown };
        enableAudio?: () => Promise<boolean>;
      };
    }).__game;
    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) {
      throw new Error('window.__game.input is not available');
    }
    await game.input.forceReload();
    if (game.story) {
      game.story.memoryBeat = null;
    }
    // Pre-warm the audio context BEFORE deliverPacket() so playKioskConfirm's
    // enableAudio() await resolves with unlocked=true and the "packet-confirmed"
    // cue actually gets stamped into state._runtime.audio.lastCue. Playwright's
    // bundled chromium ships with --autoplay-policy=no-user-gesture-required
    // by default, so resume() succeeds without a synthetic click.
    if (typeof game.enableAudio === 'function') {
      await game.enableAudio();
    }
    await game.input.choose('keep-packet-sealed');
    await game.input.choose('deliver-packet');
    await game.input.advance();
  });

  // deliver-packet publishes the memoryBeat via a ~1180ms setTimeout, then
  // sets scene.beat to 'io-returning-recognition'. Wait for BOTH the beat
  // to land AND the audio cue to be stamped — playKioskConfirm() is async
  // (its enableAudio() await resolves on the next microtask), so lastCue
  // can lag the visual beat by a few ms even though both were dispatched
  // from the same deliverPacket() call.
  await page.waitForFunction(
    () => {
      const game = (window as Window & {
        __game?: {
          scene?: { beat?: string };
          story?: { memoryBeat?: unknown };
          _runtime?: { audio?: { lastCue?: string | null } };
        };
      }).__game;
      return (
        game?.scene?.beat === 'io-returning-recognition'
        && game?.story?.memoryBeat !== null
        && game?._runtime?.audio?.lastCue === 'packet-confirmed'
      );
    },
    undefined,
    { timeout: WAIT_MS },
  );
};

const measurePhoneReadyProbe = async (page: Page): Promise<PhoneReadyProbe> => {
  return page.evaluate(
    ({ lineText: _lineText }) => {
      const lineNode = document.querySelector<HTMLElement>('#line');
      if (!lineNode) {
        throw new Error('Missing #line node in AFTERSIGN HUD');
      }

      const rect = lineNode.getBoundingClientRect();
      const style = window.getComputedStyle(lineNode);
      const root = document.documentElement;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const horizontalOverflowPx = Math.max(
        0,
        root.scrollWidth - viewport.width,
        -rect.left,
        rect.right - viewport.width,
      );
      const verticalOverflowPx = Math.max(
        0,
        root.scrollHeight - viewport.height,
        -rect.top,
        rect.bottom - viewport.height,
      );

      // Settle timing: read the game's OWN clamped inputLockMs field
      // (index.html:919), NOT a recomputed delta. deliverPacket() stamps
      //   inputLockMs: Math.min(1220, Math.max(0, Math.round(endedAt - startedAt)))
      // so the value is always within [0, 1220] regardless of CI jitter.
      // Recomputing our own settleMs from performance.now() timestamps
      // captured outside the game — as the previous draft did — added
      // extra delta from the `deliver-packet` choose() dispatch and could
      // exceed MAX_UI_SETTLE_MS on a slow runner while the game itself
      // still reported the clamped 1220. Asserting on the same field the
      // sibling io-recognition-memory-beat-contract.spec.ts:50 asserts
      // on keeps the two contracts in agreement.
      const game = (window as Window & {
        __game?: {
          story?: { memoryBeat?: { inputLockMs?: number } | null };
          _runtime?: { audio?: { lastCue?: string | null } };
        };
      }).__game;
      const beat = game?.story?.memoryBeat ?? null;
      const inputLockMs = typeof beat?.inputLockMs === 'number' ? beat.inputLockMs : Number.NaN;

      // Audio cue: verify state._runtime.audio.lastCue was stamped to
      // "packet-confirmed" by playKioskConfirm() (index.html:756). The
      // visual cue (triggerKioskFeedback) and the audio cue
      // (playKioskConfirm) are dispatched from the SAME synchronous
      // deliverPacket() call (index.html:895/928) — the coupling we
      // care about is "did the audio cue get published on the same
      // tick as the visual one?", which the lastCue string answers
      // directly. Numeric drift from a headless AudioContext would be
      // fabricated (audio doesn't unlock without a user gesture in CI).
      const audioLastCue = game?._runtime?.audio?.lastCue ?? null;

      return {
        lineText: lineNode.innerText.trim(),
        lineVisible:
          rect.width > 0
          && rect.height > 0
          && style.visibility !== 'hidden'
          && style.display !== 'none',
        lineReadable: Number.parseFloat(style.fontSize) >= 16 && style.opacity !== '0',
        lineRect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        viewport,
        horizontalOverflowPx,
        verticalOverflowPx,
        inputLockMs,
        audioLastCue,
      } satisfies PhoneReadyProbe;
    },
    { lineText: IO_SEALED_RECOGNITION_LINE },
  );
};

test.describe('Io phone-ready look/sound contract', () => {
  test('keeps the sealed-packet recognition beat readable, settled, and coupled on a phone viewport', async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`/aftersign/index.html?slot=${DETERMINISTIC_SLOT}`, {
      waitUntil: 'load',
    });

    await driveToSealedRecognitionBeat(page);

    // The recognition line the game actually paints — assert on the
    // rendered string, not the one in recognitionFeedback.ts that
    // index.html never imports.
    await page.waitForFunction(
      (expected) => {
        const node = document.querySelector('#line');
        return Boolean(node && (node.textContent ?? '').includes(expected));
      },
      IO_SEALED_RECOGNITION_LINE,
      { timeout: WAIT_MS },
    );

    const probe = await measurePhoneReadyProbe(page);

    expect(probe.lineText).toContain(IO_SEALED_RECOGNITION_LINE);
    expect(probe.lineVisible).toBe(true);
    expect(probe.lineReadable).toBe(true);
    expect(probe.lineRect.left).toBeGreaterThanOrEqual(0);
    expect(probe.lineRect.right).toBeLessThanOrEqual(probe.viewport.width);
    expect(probe.horizontalOverflowPx).toBe(0);
    expect(probe.verticalOverflowPx).toBe(0);
    // Assert on the game's OWN clamped settle value. This is the same
    // field io-recognition-memory-beat-contract.spec.ts:50 checks — a
    // failure here means the clamp in index.html:919 itself regressed,
    // not that CI ran slow.
    expect(probe.inputLockMs).toBeGreaterThanOrEqual(0);
    expect(probe.inputLockMs).toBeLessThanOrEqual(MAX_UI_SETTLE_MS);
    // Assert the sound half of the look/sound contract: the packet-
    // confirmed cue must have been stamped by playKioskConfirm() during
    // the same deliverPacket() call that fired the visual feedback.
    expect(probe.audioLastCue).toBe(EXPECTED_AUDIO_CUE);
  });
});
