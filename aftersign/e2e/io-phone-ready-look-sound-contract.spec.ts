import { expect, test, type Page } from '@playwright/test';

// Cold-start budget matches sibling AFTERSIGN specs: SwiftShader + three.js
// first WebGL context regularly blows the default 30s in CI. Every spec in
// aftersign/e2e/ opts into 90s and uses waitUntil: 'load' — 'networkidle'
// never fires when the render loop keeps requesting frames.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;
// Progressive gates for driveToSealedRecognitionBeat: authored state (beat +
// memoryBeat cleared) gets the larger slice because it runs immediately after
// forceReload() and must survive a cold SwiftShader re-init; diagnostic marks
// (MutationObserver-stamped) are microtask-driven and settle fast once the
// beat has arrived. Both are derived from WAIT_MS as a shared budget so they
// compose to ≤WAIT_MS (30 + 15 = 45s ≤ 60s) rather than being magic numbers,
// while keeping #1852's property that one slow condition cannot eat the whole
// window.
const RECOGNITION_BEAT_WAIT_MS = WAIT_MS / 2;
const RECOGNITION_MARKS_WAIT_MS = WAIT_MS / 4;
const POLL_INTERVAL_MS = 100;

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const DETERMINISTIC_SLOT = 'io-phone-ready-contract';
const STORAGE_KEY = `aftersign:kiosk-slice:${DETERMINISTIC_SLOT}`;
const MAX_VIEWPORT_EDGE_EPSILON_PX = 1;

// Issue #544 contract thresholds are pinned as literals here so the harness
// itself enforces the product envelope even if shared feel constants drift.
const MAX_UI_SETTLE_MS = 360;
const MAX_AV_DRIFT_MS = 50;
const EXPECTED_AUDIO_CUE = 'packet-confirmed';

import { expectedIoRecognitionLine } from '../src/ioRecognitionDialogue';
const IO_SEALED_RECOGNITION_LINE = expectedIoRecognitionLine('sealed', false);

type PhoneReadyProbe = {
  readonly lineText: string;
  readonly lineVisible: boolean;
  readonly lineReadable: boolean;
  readonly lineRect: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number; readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
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
  // Same 100ms clock-driven poll used by the recognition gates below: on a
  // cold SwiftShader worker rAF can stall long enough that even the pre-boot
  // input-readiness check inherits the flake vector #1852 documented for the
  // downstream gates. Using an explicit interval decouples readiness from
  // the render loop; the default polling='raf' would re-introduce it here.
  await page.waitForFunction(
    () => {
      const input = (window as Window & {
        __game?: { input?: { choose?: unknown; advance?: unknown; forceReload?: unknown } };
      }).__game?.input;
      return Boolean(input?.choose && input.advance && input.forceReload);
    },
    undefined,
    { timeout: WAIT_MS, polling: POLL_INTERVAL_MS },
  );
};

const installPhoneReadyRuntimeMarks = async (page: Page) => {
  await page.evaluate(({ expectedCue, pollIntervalMs }) => {
    const win = window as Window & {
      __ioPhoneReadyMarks?: { recognitionTriggeredAt?: number; lineSettledAt?: number; audioCueAt?: number };
      __game?: { scene?: { beat?: string }; _runtime?: { audio?: { lastCue?: string | null; lastCueAt?: number | null } } };
    };
    win.__ioPhoneReadyMarks = {};
    const initialLineText = document.querySelector('#line')?.textContent?.trim() ?? '';
    const initialAudioCueAt = win.__game?._runtime?.audio?.lastCueAt ?? null;

    // MutationObserver stamps the DOM write as a microtask. Sample game/audio
    // state on the task queue as well: a cold SwiftShader worker can starve
    // rAF, but it must not prevent this test-only diagnostic stamp from seeing
    // the authored cue.
    const stampMarks = () => {
      const game = win.__game;
      const lineText = document.querySelector('#line')?.textContent?.trim() ?? '';
      const marks = win.__ioPhoneReadyMarks;
      if (!marks) return;
      if (marks.recognitionTriggeredAt === undefined && game?.scene?.beat === 'io-return-recognition') marks.recognitionTriggeredAt = performance.now();
      if (marks.recognitionTriggeredAt !== undefined && marks.lineSettledAt === undefined && lineText.startsWith('I remember you') && lineText !== initialLineText) marks.lineSettledAt = performance.now();
      const audio = game?._runtime?.audio;
      if (marks.recognitionTriggeredAt !== undefined && marks.audioCueAt === undefined && audio?.lastCue === expectedCue && audio.lastCueAt !== null && audio.lastCueAt !== initialAudioCueAt) marks.audioCueAt = audio.lastCueAt;
    };

    const lineNode = document.querySelector('#line');
    if (lineNode) new MutationObserver(stampMarks).observe(lineNode, { childList: true, characterData: true, subtree: true });
    stampMarks();
    window.setInterval(stampMarks, pollIntervalMs);
  }, { expectedCue: EXPECTED_AUDIO_CUE, pollIntervalMs: POLL_INTERVAL_MS });
};

const driveToSealedRecognitionBeat = async (page: Page) => {
  await waitForGame(page);
  await installPhoneReadyRuntimeMarks(page);
  await page.evaluate(async () => {
    const game = (window as Window & { __game?: { input?: { choose?: (choiceId: string) => Promise<void>; advance?: () => Promise<void>; forceReload?: () => Promise<void> }; story?: { memoryBeat?: unknown }; enableAudio?: () => Promise<boolean> } }).__game;
    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) throw new Error('window.__game.input is not available');
    await game.input.forceReload();
    if (game.story) game.story.memoryBeat = null;
    if (typeof game.enableAudio === 'function') await game.enableAudio();
    await game.input.choose('keep-packet-sealed');
    await game.input.choose('deliver-packet');
    await game.input.advance();
  });

  // Separate authored state from diagnostic marks: neither slow condition can
  // consume the full old WAIT_MS window, and their composed budget stays ≤WAIT_MS.
  await page.waitForFunction(
    () => {
      const game = (window as Window & { __game?: { scene?: { beat?: string }; story?: { memoryBeat?: unknown } } }).__game;
      return game?.scene?.beat === 'io-return-recognition' && game.story?.memoryBeat !== null;
    },
    undefined,
    { timeout: RECOGNITION_BEAT_WAIT_MS, polling: POLL_INTERVAL_MS },
  );
  await page.waitForFunction(
    (expectedCue) => {
      const win = window as Window & { __game?: { _runtime?: { audio?: { lastCue?: string | null } } }; __ioPhoneReadyMarks?: Partial<RuntimeMarks> };
      const marks = win.__ioPhoneReadyMarks;
      return win.__game?._runtime?.audio?.lastCue === expectedCue && marks?.recognitionTriggeredAt !== undefined && marks.lineSettledAt !== undefined && marks.audioCueAt !== undefined;
    },
    EXPECTED_AUDIO_CUE,
    { timeout: RECOGNITION_MARKS_WAIT_MS, polling: POLL_INTERVAL_MS },
  );
};

const measurePhoneReadyProbe = async (page: Page): Promise<PhoneReadyProbe> => page.evaluate(() => {
  const lineNode = document.querySelector<HTMLElement>('#line');
  if (!lineNode) throw new Error('Missing #line node in AFTERSIGN HUD');
  const rect = lineNode.getBoundingClientRect();
  const style = window.getComputedStyle(lineNode);
  const root = document.documentElement;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const win = window as Window & { __game?: { _runtime?: { audio?: { lastCue?: string | null } } }; __ioPhoneReadyMarks?: Partial<RuntimeMarks> };
  const marks = win.__ioPhoneReadyMarks;
  if (marks?.recognitionTriggeredAt === undefined || marks.lineSettledAt === undefined || marks.audioCueAt === undefined) throw new Error('Missing Io phone-ready runtime marks');
  return {
    lineText: lineNode.innerText.trim(),
    lineVisible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
    lineReadable: Number.parseFloat(style.fontSize) >= 16 && style.opacity !== '0',
    lineRect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
    viewport,
    horizontalOverflowPx: Math.max(0, root.scrollWidth - viewport.width, -rect.left, rect.right - viewport.width),
    verticalOverflowPx: Math.max(0, root.scrollHeight - viewport.height, -rect.top, rect.bottom - viewport.height),
    settleMs: Math.max(0, marks.lineSettledAt - marks.recognitionTriggeredAt),
    avDriftMs: Math.abs(marks.audioCueAt - marks.lineSettledAt),
    audioLastCue: win.__game?._runtime?.audio?.lastCue ?? null,
  } satisfies PhoneReadyProbe;
}, undefined);

test.describe('Io phone-ready look/sound contract', () => {
  test('keeps the sealed-packet recognition beat readable, settled, and coupled on a phone viewport', async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.addInitScript((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.goto(`/aftersign/index.html?slot=${DETERMINISTIC_SLOT}`, { waitUntil: 'load' });
    await driveToSealedRecognitionBeat(page);
    await expect.poll(() => measurePhoneReadyProbe(page), { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] }).toMatchObject({
      lineText: expect.stringContaining(IO_SEALED_RECOGNITION_LINE), lineVisible: true, lineReadable: true, audioLastCue: EXPECTED_AUDIO_CUE,
    });
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
