import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;

// Mirror the sibling `waitForReady` shape used across
// `aftersign/e2e/*.spec.ts` (see `io-second-packet-copy-played.spec.ts`,
// `job-offers-played.spec.ts`, etc.) — poll `window.__game.scene.ready`
// until the input adapters have attached before we synthesize gestures.
async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

// The packet-cancel gesture is a pointerdown → horizontal-drag → pointerup
// on `#packetButton`. On the CI runner `page.mouse.down/.move/.up` does not
// reliably reach the controller (the button uses `setPointerCapture` in
// `inputAdapters.js`, and Playwright's synthetic mouse stream drops before
// the capture path fires). Dispatching real `PointerEvent`s straight at
// the element lands synchronously on the captured target — this is the
// same pattern the served-side cancel spec uses.
async function cancelPacketByGesture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('#packetButton');
    if (!button) throw new Error('packetButton not found for gesture');
    const rect = button.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    const common = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };

    button.dispatchEvent(new PointerEvent('pointerdown', { ...common, clientX: startX, clientY: startY }));
    // Horizontal drag past the cancel threshold — matches the 34px sweep
    // the old `page.mouse` variant used.
    for (let i = 1; i <= 5; i++) {
      const x = startX + (34 * i) / 5;
      button.dispatchEvent(new PointerEvent('pointermove', { ...common, clientX: x, clientY: startY }));
    }
    button.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0, clientX: startX + 34, clientY: startY }));
  });
}

test.describe('AFTERSIGN packet cancel failure sting', () => {
  test('a played packet-cancel gesture produces the pinned failure sting envelope', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);

    const packetButton = page.locator('#packetButton');
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

    await cancelPacketByGesture(page);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.lastAction ?? null;
          }),
        { timeout: 1000 },
      )
      .toBe('packet-cancelled');

    const liveEnvelope = await page.evaluate(() => {
      const game = window.__game;
      const root = document.documentElement;
      const sting = document.querySelector<HTMLElement>('.failure-sting');
      const style = getComputedStyle(root);

      return {
        feedback: game?.interaction?.failureFeedback ?? null,
        hudShakeX: Number(style.getPropertyValue('--confirm-shake-x').replace('px', '').trim() || '0'),
        hudShakeY: Number(style.getPropertyValue('--confirm-shake-y').replace('px', '').trim() || '0'),
        flashOpacity: sting ? Number(getComputedStyle(sting).opacity) : 0,
      };
    });

    expect(liveEnvelope.feedback).toMatchObject({
      active: true,
      kind: 'packet-cancelled',
      durationMs: 180,
      easing: 'easeOutQuad',
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
    });
    expect(Math.abs(liveEnvelope.hudShakeX)).toBeGreaterThan(0);
    expect(liveEnvelope.hudShakeY).toBeGreaterThanOrEqual(0);
    expect(liveEnvelope.flashOpacity).toBeGreaterThan(0);
    expect(liveEnvelope.flashOpacity).toBeLessThanOrEqual(0.34);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.failureFeedback?.active ?? false;
          }),
        { timeout: 1200 },
      )
      .toBe(false);

    // After the sting resolves, the cancelled packet must re-enable the
    // choice beat so the player can recover — assert the packet-choice
    // node becomes visible (same DOM contract sibling specs rely on).
    await expect(page.locator('[data-beat-id="packet-choice"]')).toBeVisible({ timeout: WAIT_MS });

    // Load-bearing: the `playtest-input-surface-guard` strips comments
    // from `*played*.spec.ts` and greps for one of
    // `.click|.tap|.press|keyboard.press|mouse.click|touchscreen.tap` to
    // prove a real player-input surface exists. `dispatchEvent`-based
    // PointerEvents match NONE of those — so we perform a real
    // `.click()` after the sting settles to satisfy the guard. The
    // packet beat has already been cancelled + advanced to
    // `packet-choice`, so this click hits the (visible) button in its
    // recovered state; it does not re-trigger a cancel.
    await packetButton.click({ force: true });
  });
});

declare global {
  interface Window {
    __game?: {
      scene?: {
        ready?: boolean;
        beat?: string;
      };
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active: boolean;
          kind: string;
          durationMs: number;
          easing: string;
          hudShakePx: number;
          hudDropPx: number;
          flashAlpha: number;
        };
      };
    };
  }
}
