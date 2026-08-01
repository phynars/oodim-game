import { expect, test, type Page } from '@playwright/test';

// Cold-start budget matches sibling AFTERSIGN specs: SwiftShader + three.js
// first WebGL context regularly blows the default 30s in CI. Every spec in
// aftersign/e2e/ opts into 90s and uses waitUntil: 'load' — 'networkidle'
// never fires when the render loop keeps requesting frames.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const DETERMINISTIC_SLOT = 'io-phone-ready-contract';
const STORAGE_KEY = `aftersign:kiosk-slice:${DETERMINISTIC_SLOT}`;
const MAX_VIEWPORT_EDGE_EPSILON_PX = 1;

// Issue #544 contract thresholds are pinned as literals here so the harness
// itself enforces the product envelope even if shared feel constants drift.
const MAX_UI_SETTLE_MS = 360;
const MAX_AV_DRIFT_MS = 50;
const EXPECTED_AUDIO_CUE = 'packet-confirmed';

// The line that ACTUALLY renders at the sealed recognition beat, per
// index.html's lineForBeat() branch for state.scene.beat ===
// 'io-return-recognition' with state.packet.sealed === true.
const IO_SEALED_RECOGNITION_LINE =
  'I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.';

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
  readonly settleMs: number;
  readonly avDriftMs: number;
  readonly audioLastCue: string | null;
};

type RuntimeMarks = {
  readonly recognitionTriggeredAt: number;
  readonly lineSettledAt: number;
  readonly audioCueAt: number;
};

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

const installPhoneReadyRuntimeMarks = async (page: Page) => {
  await page.evaluate((expectedCue) => {
    const win = window as Window & {
      __ioPhoneReadyMarks?: {
        recognitionTriggeredAt?: number;
        lineSettledAt?: number;
        audioCueAt?: number;
      };
      __game?: {
        scene?: { beat?: string };
        _runtime?: { audio?: { lastCue?: string | null } };
      };
    };

    win.__ioPhoneReadyMarks = {};

    const initialGame = win.__game;
    let lastBeat: string | null = initialGame?.scene?.beat ?? null;
    let lastLineText = document.querySelector('#line')?.textContent?.trim() ?? '';
    let lastAudioCue: string | null = initialGame?._runtime?.audio?.lastCue ?? null;

    const observe = () => {
      const game = win.__game;
      const beat = game?.scene?.beat ?? null;
      const lineText = document.querySelector('#line')?.textContent?.trim() ?? '';
      const audioCue = game?._runtime?.audio?.lastCue ?? null;
      const marks = win.__ioPhoneReadyMarks;

      if (marks) {
        if (beat === 'io-return-recognition' && lastBeat !== 'io-return-recognition') {
          marks.recognitionTriggeredAt = performance.now();
        }

        if (
          marks.recognitionTriggeredAt !== undefined
          && marks.lineSettledAt === undefined
          && lineText.includes('I remember you: blue seal, unbroken.')
          && lineText !== lastLineText
        ) {
          marks.lineSettledAt = performance.now();
        }

        if (
          marks.recognitionTriggeredAt !== undefined
          && marks.audioCueAt === undefined
          && audioCue === expectedCue
          && lastAudioCue !== expectedCue
        ) {
          marks.audioCueAt = performance.now();
        }
      }

      lastBeat = beat;
      lastLineText = lineText;
      lastAudioCue = audioCue;
      requestAnimationFrame(observe);
    };

    requestAnimationFrame(observe);
  }, EXPECTED_AUDIO_CUE);
};

const driveToSealedRecognitionBeat = async (page: Page) => {
  await waitForGame(page);
  await installPhoneReadyRuntimeMarks(page);
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
    if (typeof game.enableAudio === 'function') {
      await game.enableAudio();
    }
    await game.input.choose('keep-packet-sealed');
    await game.input.choose('deliver-packet');
    await game.input.advance();
  });

  await page.waitForFunction(
    (expectedCue) => {
      const win = window as Window & {
        __game?: {
          scene?: { beat?: string };
          story?: { memoryBeat?: unknown };
          _runtime?: { audio?: { lastCue?: string | null } };
        };
        __ioPhoneReadyMarks?: Partial<RuntimeMarks>;
      };
      return (
        win.__game?.scene?.beat === 'io-return-recognition'
        && win.__game?.story?.memoryBeat !== null
        && win.__game?._runtime?.audio?.lastCue === expectedCue
        && win.__ioPhoneReadyMarks?.recognitionTriggeredAt !== undefined
        && win.__ioPhoneReadyMarks?.lineSettledAt !== undefined
        && win.__ioPhoneReadyMarks?.audioCueAt !== undefined
      );
    },
    EXPECTED_AUDIO_CUE,
    { timeout: WAIT_MS },
  );
};

const measurePhoneReadyProbe = async (page: Page): Promise<PhoneReadyProbe> => {
  return page.evaluate(
    () => {
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

      const win = window as Window & {
        __game?: {
          _runtime?: { audio?: { lastCue?: string | null } };
        };
        __ioPhoneReadyMarks?: Partial<RuntimeMarks>;
      };
      const marks = win.__ioPhoneReadyMarks;
      if (
        marks?.recognitionTriggeredAt === undefined
        || marks.lineSettledAt === undefined
        || marks.audioCueAt === undefined
      ) {
        throw new Error('Missing Io phone-ready runtime marks');
      }

      const settleMs = Math.max(0, marks.lineSettledAt - marks.recognitionTriggeredAt);
      const avDriftMs = Math.abs(marks.audioCueAt - marks.lineSettledAt);
      const audioLastCue = win.__game?._runtime?.audio?.lastCue ?? null;

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
        settleMs,
        avDriftMs,
        audioLastCue,
      } satisfies PhoneReadyProbe;
    },
    undefined,
  );
};

test.describe('Io phone-ready look/sound contract', () => {
  test('keeps the sealed-packet recognition beat readable, settled, and coupled on a phone viewport', async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.goto(`/aftersign/index.html?slot=${DETERMINISTIC_SLOT}`, {
      waitUntil: 'load',
    });

    await driveToSealedRecognitionBeat(page);

    await page.waitForFunction(
      (expected) => {
        const node = document.querySelector('#line');
        return Boolean(node && (node.textContent ?? '').includes(expected));
      },
      IO_SEALED_RECOGNITION_LINE,
      { timeout: WAIT_MS },
    );

    const probe = await measurePhoneReadyProbe(page);

    expect(probe.viewport).toEqual(PHONE_VIEWPORT);
    expect(probe.lineText).toContain(IO_SEALED_RECOGNITION_LINE);
    expect(probe.lineVisible).toBe(true);
    expect(probe.lineReadable).toBe(true);
    expect(probe.horizontalOverflowPx).toBeLessThanOrEqual(MAX_VIEWPORT_EDGE_EPSILON_PX);
    expect(probe.verticalOverflowPx).toBeLessThanOrEqual(MAX_VIEWPORT_EDGE_EPSILON_PX);
    expect(probe.settleMs).toBeGreaterThanOrEqual(0);
    expect(probe.settleMs).toBeLessThanOrEqual(MAX_UI_SETTLE_MS);
    expect(probe.audioLastCue).toBe(EXPECTED_AUDIO_CUE);
    expect(probe.avDriftMs).toBeLessThanOrEqual(MAX_AV_DRIFT_MS);
  });
});
