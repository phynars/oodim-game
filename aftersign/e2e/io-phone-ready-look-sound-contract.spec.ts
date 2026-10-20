import { expect, test, type Page } from '@playwright/test';

const COLD_START_MS = 90_000;
const GAME_READY_WAIT_MS = 45_000;
const RECOGNITION_BEAT_WAIT_MS = 15_000;
const RECOGNITION_MARKS_WAIT_MS = 10_000;
const PHONE_READY_PROBE_WAIT_MS = 5_000;
const POLL_INTERVAL_MS = 100;

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const DETERMINISTIC_SLOT = 'io-phone-ready-contract';
const STORAGE_KEY = `aftersign:kiosk-slice:${DETERMINISTIC_SLOT}`;
const MAX_VIEWPORT_EDGE_EPSILON_PX = 1;
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
  readonly confirmVisualAt: number;
  readonly audioCueAt: number;
};

const waitForGame = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const input = (window as Window & {
        __game?: { input?: { choose?: unknown; advance?: unknown; forceReload?: unknown } };
      }).__game?.input;
      return Boolean(input?.choose && input.advance && input.forceReload);
    },
    undefined,
    { timeout: GAME_READY_WAIT_MS, polling: POLL_INTERVAL_MS },
  );
};

const installPhoneReadyRuntimeMarks = async (page: Page) => {
  await page.evaluate(({ expectedCue, pollIntervalMs }) => {
    const win = window as Window & {
      __ioPhoneReadyMarks?: { recognitionTriggeredAt?: number; lineSettledAt?: number; confirmVisualAt?: number; audioCueAt?: number };
      __game?: {
        scene?: { beat?: string };
        interaction?: { confirmStartedAt?: number | null };
        _runtime?: { audio?: { lastCue?: string | null; lastCueAt?: number | null } };
      };
    };
    win.__ioPhoneReadyMarks = {};
    // Why no "non-initial" guard against a pre-tap confirm/cue timestamp:
    //
    // The spec starts with `page.goto(...)` on a fresh Playwright page, so
    // the aftersign module just loaded. At that point both candidate stamps
    // are null by construction:
    //   * `state.interaction.confirmStartedAt` — initialised null at
    //     aftersign/main.js:1230 and only written by `triggerKioskFeedback`
    //     at aftersign/main.js:4409 (the deliver tap).
    //   * `state._runtime.audio.lastCueAt` — initialised null at
    //     aftersign/main.js:1287 and only written when a cue plays
    //     (aftersign/main.js:476, 4261, 4282, 4326, 4334, 4359).
    // `installPhoneReadyRuntimeMarks` runs AFTER the deterministic
    // `forceReload`, immediately before the packet/deliver taps that
    // produce the first confirm + first `packet-confirmed` cue. There is
    // no prior tap in this page session, so the first non-null value we
    // observe belongs to the delivery we just drove. A "non-initial"
    // guard against a baseline value is unnecessary — and worse, it was
    // the race: when the runtime clock reports the same `performance.now()`
    // integer for the baseline read and the real stamp (common at this
    // poll cadence), the guard rejects the authentic confirm and the gate
    // never resolves.
    const stampMarks = () => {
      const game = win.__game;
      const lineText = document.querySelector('#line')?.textContent?.trim() ?? '';
      const marks = win.__ioPhoneReadyMarks;
      if (!marks) return;
      const audio = game?._runtime?.audio;
      if (marks.audioCueAt === undefined && audio?.lastCue === expectedCue && audio.lastCueAt !== null) marks.audioCueAt = audio.lastCueAt;
      const confirmStartedAt = game?.interaction?.confirmStartedAt ?? null;
      if (marks.confirmVisualAt === undefined && confirmStartedAt !== null) marks.confirmVisualAt = confirmStartedAt;
      if (marks.recognitionTriggeredAt === undefined && game?.scene?.beat === 'io-return-recognition') marks.recognitionTriggeredAt = performance.now();
      // The line can be rendered before the next task after the beat changes.
      // Do not require a DOM-text delta: that race made this diagnostic mark
      // permanently unreachable even though the authored recognition beat was live.
      if (marks.recognitionTriggeredAt !== undefined && marks.lineSettledAt === undefined && lineText.startsWith('I remember you')) marks.lineSettledAt = performance.now();
    };

    const lineNode = document.querySelector('#line');
    if (lineNode) new MutationObserver(stampMarks).observe(lineNode, { childList: true, characterData: true, subtree: true });
    stampMarks();
    window.setInterval(stampMarks, pollIntervalMs);
  }, { expectedCue: EXPECTED_AUDIO_CUE, pollIntervalMs: POLL_INTERVAL_MS });
};

const driveToSealedRecognitionBeat = async (page: Page) => {
  await waitForGame(page);
  await page.evaluate(async () => {
    const game = (window as Window & { __game?: { input?: { forceReload?: () => Promise<void> }; story?: { memoryBeat?: unknown } } }).__game;
    if (!game?.input?.forceReload) throw new Error('window.__game.input.forceReload is not available');
    await game.input.forceReload();
    if (game.story) game.story.memoryBeat = null;
  });
  await waitForGame(page);
  await installPhoneReadyRuntimeMarks(page);

  await page.locator('#packetButton').click();
  await page.locator('#deliverButton').click();

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
      return win.__game?._runtime?.audio?.lastCue === expectedCue && marks?.recognitionTriggeredAt !== undefined && marks.lineSettledAt !== undefined && marks.confirmVisualAt !== undefined && marks.audioCueAt !== undefined;
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
  if (marks?.recognitionTriggeredAt === undefined || marks.lineSettledAt === undefined || marks.confirmVisualAt === undefined || marks.audioCueAt === undefined) throw new Error('Missing Io phone-ready runtime marks');
  return {
    lineText: lineNode.innerText.trim(),
    lineVisible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
    lineReadable: Number.parseFloat(style.fontSize) >= 16 && style.opacity !== '0',
    lineRect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
    viewport,
    horizontalOverflowPx: Math.max(0, root.scrollWidth - viewport.width, -rect.left, rect.right - viewport.width),
    verticalOverflowPx: Math.max(0, root.scrollHeight - viewport.height, -rect.top, rect.bottom - viewport.height),
    settleMs: Math.max(0, marks.lineSettledAt - marks.recognitionTriggeredAt),
    avDriftMs: Math.abs(marks.audioCueAt - marks.confirmVisualAt),
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
    await expect.poll(() => measurePhoneReadyProbe(page), { timeout: PHONE_READY_PROBE_WAIT_MS, intervals: [100, 250, 500, 1000] }).toMatchObject({
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
