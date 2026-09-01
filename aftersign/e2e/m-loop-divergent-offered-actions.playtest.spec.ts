import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type OfferedAction = {
  id: string;
  jobId: string;
  routeRisk: string;
  memoryGate: string;
  label: string;
};

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function newPhoneContext(browser: Parameters<typeof test>[0]['browser']): Promise<BrowserContext> {
  return browser.newContext({
    viewport: PHONE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
}

async function seedMemory(page: Page, memory: Record<string, unknown>): Promise<void> {
  await page.addInitScript((seededMemory) => {
    window.localStorage.setItem('aftersign:player-memory', JSON.stringify(seededMemory));
    window.localStorage.setItem('aftersign:player-id', `playtest-${Date.now()}-${Math.random()}`);
  }, memory);
}

async function bootToPacketOffer(page: Page): Promise<void> {
  await page.goto('/aftersign/');

  const bootButton = page.getByRole('button').first();
  await expect(bootButton).toBeVisible();

  for (let taps = 0; taps < 24; taps += 1) {
    const state = await page.evaluate(() => window.__game?.story?.beatId ?? window.__game?.beatId ?? null);
    if (state === 'packet-offered') return;

    const visibleButtons = await page.getByRole('button').filter({ hasNotText: /^$/ }).all();
    const tappable = visibleButtons.find(async (button) => await button.isVisible());
    if (!tappable) break;
    await visibleButtons[0].tap();
  }

  await expect.poll(
    () => page.evaluate(() => window.__game?.story?.beatId ?? window.__game?.beatId ?? null),
    { message: 'played taps should reach the packet-offered beat' },
  ).toBe('packet-offered');
}

async function visibleOfferedActions(page: Page): Promise<OfferedAction[]> {
  await expect(page.locator('#offeredJobs')).toBeVisible();

  return page.locator('#offeredJobs [data-aftersign-tap-choice][data-aftersign-job-take-action]').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !element.hasAttribute('disabled');
      })
      .map((node) => {
        const element = node as HTMLElement;
        return {
          id: element.dataset.aftersignJobTakeAction ?? '',
          jobId: element.dataset.aftersignTapChoice ?? '',
          routeRisk: element.dataset.routeRisk ?? '',
          memoryGate: element.dataset.mloopMemoryGate ?? '',
          label: element.textContent?.trim() ?? '',
        };
      }),
  );
}

async function tapFirstVisibleOfferedAction(page: Page, action: OfferedAction): Promise<void> {
  const button = page.locator(
    `#offeredJobs [data-aftersign-job-take-action="${action.id}"][data-aftersign-tap-choice="${action.jobId}"]`,
  );
  await expect(button).toBeVisible();
  await button.tap();
  await expect(button).toHaveAttribute('data-aftersign-job-take', 'armed');

  await expect.poll(
    () => page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
    { message: 'window.__game is assertion-only: the visible tap should commit the same offered action' },
  ).toBe(`${action.id}:${action.jobId}`);
}

test.describe('M-LOOP divergent offered actions', () => {
  test('two memory records produce different tappable job offers and taps commit the chosen offer', async ({ browser }) => {
    const freshContext = await newPhoneContext(browser);
    const returningContext = await newPhoneContext(browser);

    try {
      const freshPage = await freshContext.newPage();
      const returningPage = await returningContext.newPage();

      await seedMemory(freshPage, {
        playerName: 'Fresh Courier',
        trust: 0,
        completedDeliveries: 0,
        routeRisks: [],
        openedPackets: 0,
      });

      await seedMemory(returningPage, {
        playerName: 'Returning Courier',
        trust: 3,
        completedDeliveries: 2,
        routeRisks: ['dark-cut'],
        openedPackets: 1,
      });

      await bootToPacketOffer(freshPage);
      await bootToPacketOffer(returningPage);

      const freshActions = await visibleOfferedActions(freshPage);
      const returningActions = await visibleOfferedActions(returningPage);

      expect(freshActions.length, 'fresh save should expose at least one visible offered action').toBeGreaterThan(0);
      expect(returningActions.length, 'returning save should expose at least one visible offered action').toBeGreaterThan(0);

      const freshActionKeys = freshActions.map((action) => `${action.id}:${action.jobId}:${action.routeRisk}:${action.memoryGate}`);
      const returningActionKeys = returningActions.map(
        (action) => `${action.id}:${action.jobId}:${action.routeRisk}:${action.memoryGate}`,
      );

      expect(returningActionKeys, 'different memory records must produce different available element-level actions').not.toEqual(
        freshActionKeys,
      );

      await tapFirstVisibleOfferedAction(freshPage, freshActions[0]);
      await tapFirstVisibleOfferedAction(returningPage, returningActions[0]);
    } finally {
      await freshContext.close();
      await returningContext.close();
    }
  });
});

declare global {
  interface Window {
    __game?: {
      beatId?: string;
      story?: { beatId?: string };
      interaction?: { lastAction?: string };
    };
  }
}
