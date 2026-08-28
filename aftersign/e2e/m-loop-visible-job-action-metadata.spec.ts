import { expect, test, type Locator, type Page } from '@playwright/test';

const PHONE = { width: 390, height: 844 };
const WAIT_MS = 10_000;

test.use({
  hasTouch: true,
  viewport: PHONE,
});

async function bootAftersign(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`);
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function tapWhenVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: WAIT_MS });
  await locator.tap({ timeout: WAIT_MS });
}

async function expectVisibleJobAction(
  locator: Locator,
  expected: { label: RegExp; risk: 'low' | 'medium' | 'high' | 'safe' | 'risky' | 'repair' },
): Promise<void> {
  await expect(locator).toBeVisible({ timeout: WAIT_MS });
  await expect(locator).toHaveText(expected.label);

  const currentRisk = await locator.getAttribute('data-route-risk');
  const legacyRisk = await locator.getAttribute('data-offered-job-risk');
  expect(currentRisk ?? legacyRisk).toBe(expected.risk);
}

test.describe('M-LOOP played job actions', () => {
  test('a phone player sees a tappable job offer with authored label and route-risk metadata', async ({ page }) => {
    const slot = `m-loop-visible-job-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await bootAftersign(page, slot);

    const firstOffer = page.getByRole('button', { name: /safe delivery/i });
    await expectVisibleJobAction(firstOffer, {
      label: /safe delivery/i,
      risk: 'low',
    });

    await tapWhenVisible(firstOffer);

    const deliverPacket = page.locator('#deliverButton');
    if (await deliverPacket.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tapWhenVisible(deliverPacket);
    }

    const acknowledgeRoute = page.locator('#acknowledgeRouteButton');
    if (await acknowledgeRoute.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tapWhenVisible(acknowledgeRoute);
    }

    const preservePacket = page.locator('#preservePacketButton');
    if (await preservePacket.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tapWhenVisible(preservePacket);
    }

    const confirmDelivery = page.locator('#confirmDeliveryButton');
    if (await confirmDelivery.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tapWhenVisible(confirmDelivery);
    }

    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().scene.beat === 'io-return-recognition',
      undefined,
      { timeout: WAIT_MS },
    );

    const snapshot = await page.evaluate(() => window.__game?.getSnapshot?.());
    expect(snapshot?.scene.beat).toBe('io-return-recognition');
  });
});

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
    };
  }
}
