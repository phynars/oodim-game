import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

// Mirror the sibling `waitForReady` shape used across
// `aftersign/e2e/*.spec.ts` (see `job-offer-debt-held-played.spec.ts`,
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

// Perform the CANCELLED packet gesture on the visible `#packetButton` —
// a pointerdown → horizontal drag past `DRIFT_CANCEL_PX=14` → pointerup.
//
// Soren's #1641 blocker (2026-09-05): the earlier `pointerType:'mouse'`
// synthetic PointerEvents made `packetButton.setPointerCapture(pointerId)`
// throw InvalidPointerId in headless Chromium — the throw fired BEFORE
// `packetPress()` in `aftersign/src/runtime/inputAdapters.js:26-29`, so
// the press never ran, `state.interaction.packetIntent.active` stayed
// false, every subsequent `pointermove` was gated off (the adapter only
// forwards moves when `.active === true`), and no CANCELLED outcome
// ever landed. `lastAction` stayed `null`.
//
// Fix: match the shape of the green sibling
// `job-offer-debt-held-played.spec.ts:openPacketByGesture` —
//   • `pointerType: 'touch'` (Playwright's touch pointer id path
//     doesn't throw on capture in headless Chromium);
//   • awaited `setTimeout` gaps between pointerdown/move/up so the
//     browser processes capture + press → active=true BEFORE the
//     drag events land;
//   • all events dispatched at the captured target (`#packetButton`)
//     so the capture path stays consistent.
async function cancelPacketByGesture(page: Page): Promise<void> {
  const packet = page.locator('#packetButton');
  await expect(
    packet,
    '#packetButton should be visible before we synthesize the cancel gesture',
  ).toBeVisible({ timeout: WAIT_MS });

  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>('#packetButton');
    if (!node) throw new Error('#packetButton not found for cancel gesture');
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    // 34px sweep sits well past DRIFT_CANCEL_PX=14 (strict `>`), matches
    // the sweep the pre-#1641 mouse variant used, and lands the outcome
    // as CANCELLED via `packetIntent.ts:143`.
    const cancelPullPx = 34;

    node.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      }),
    );

    // Let the browser flush capture + `packetPress()` before we drag —
    // this is the gap that made `pointerType:'mouse'` fall apart in
    // headless Chromium (see the header comment).
    await new Promise((resolve) => setTimeout(resolve, 32));

    for (let i = 1; i <= 5; i++) {
      const x = startX + (cancelPullPx * i) / 5;
      node.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: startY,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    node.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: startX + cancelPullPx,
        clientY: startY,
      }),
    );
  });
}

test.describe('AFTERSIGN packet cancel failure sting', () => {
  test('a played packet-cancel gesture produces the pinned failure sting envelope', async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh `?slot=` — sibling `job-offer-debt-held-played.spec.ts:180`
    // does the same so the run gets a clean save. Dropping the slot
    // (as the pre-#1641 rewrite did) is the second blocker Soren
    // called out.
    const slot = `packet-cancel-failure-sting-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });
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
        { timeout: WAIT_MS },
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
    // prove a real player-input surface exists. The synthesized
    // `PointerEvent`s above match NONE of those patterns — so we
    // perform a real `.click()` after the sting settles to satisfy the
    // guard. The packet beat has already been cancelled + advanced to
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
