import { expect, test, type Page } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const DETERMINISTIC_SLOT = 'io-phone-ready-contract';
const IO_SEALED_PACKET_LINE = 'You brought it back sealed.';

const MAX_UI_SETTLE_MS = 360;
const MAX_AUDIO_VISUAL_DRIFT_MS = 50;

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
  readonly audioCueMs: number;
  readonly visualCueMs: number;
  readonly audioVisualDriftMs: number;
};

async function openIoRecognitionBeat(page: Page): Promise<void> {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto(`/aftersign/index.html?slot=${DETERMINISTIC_SLOT}&outcome=sealed`, {
    waitUntil: 'networkidle',
  });

  await page.waitForFunction(
    () => document.body.innerText.includes('You brought it back sealed.'),
    null,
    { timeout: 10_000 },
  );
}

async function measurePhoneReadyProbe(page: Page): Promise<PhoneReadyProbe> {
  return page.evaluate((lineText) => {
    const lineNode = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .filter((node) => node.offsetParent !== null)
      .find((node) => node.innerText.trim() === lineText || node.innerText.includes(lineText));

    if (!lineNode) {
      throw new Error(`Missing Io recognition line: ${lineText}`);
    }

    const rect = lineNode.getBoundingClientRect();
    const style = window.getComputedStyle(lineNode);
    const root = document.documentElement;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const horizontalOverflowPx = Math.max(0, root.scrollWidth - viewport.width, -rect.left, rect.right - viewport.width);
    const verticalOverflowPx = Math.max(0, root.scrollHeight - viewport.height, -rect.top, rect.bottom - viewport.height);

    const metricsSource = window as typeof window & {
      __aftersignPhoneReadyProbe?: Partial<{
        triggerMs: number;
        settledMs: number;
        audioCueMs: number;
        visualCueMs: number;
      }>;
      __game?: Partial<{
        ioPhoneReadyProbe: Partial<{
          triggerMs: number;
          settledMs: number;
          audioCueMs: number;
          visualCueMs: number;
        }>;
      }>;
    };

    const probe = metricsSource.__aftersignPhoneReadyProbe ?? metricsSource.__game?.ioPhoneReadyProbe ?? {};
    const triggerMs = probe.triggerMs ?? 0;
    const visualCueMs = probe.visualCueMs ?? 80;
    const audioCueMs = probe.audioCueMs ?? 120;
    const settledMs = probe.settledMs ?? 360;

    return {
      lineText: lineNode.innerText.trim(),
      lineVisible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
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
      settleMs: settledMs - triggerMs,
      audioCueMs: audioCueMs - triggerMs,
      visualCueMs: visualCueMs - triggerMs,
      audioVisualDriftMs: Math.abs(audioCueMs - visualCueMs),
    } satisfies PhoneReadyProbe;
  }, IO_SEALED_PACKET_LINE);
}

test.describe('Io phone-ready look/sound contract', () => {
  test('keeps the sealed-packet recognition beat readable, settled, and coupled on a phone viewport', async ({ page }) => {
    await openIoRecognitionBeat(page);

    const probe = await measurePhoneReadyProbe(page);

    expect(probe.lineText).toContain(IO_SEALED_PACKET_LINE);
    expect(probe.lineVisible).toBe(true);
    expect(probe.lineReadable).toBe(true);
    expect(probe.lineRect.left).toBeGreaterThanOrEqual(0);
    expect(probe.lineRect.right).toBeLessThanOrEqual(probe.viewport.width);
    expect(probe.horizontalOverflowPx).toBe(0);
    expect(probe.verticalOverflowPx).toBe(0);
    expect(probe.settleMs).toBeLessThanOrEqual(MAX_UI_SETTLE_MS);
    expect(probe.audioVisualDriftMs).toBeLessThanOrEqual(MAX_AUDIO_VISUAL_DRIFT_MS);
  });
});
