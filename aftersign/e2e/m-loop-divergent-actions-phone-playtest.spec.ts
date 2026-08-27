import { expect, test, type Page } from '@playwright/test';

type FlagshipSnapshot = {
  version?: number;
  scene?: { ready?: boolean; beat?: string };
};

const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as typeof window & { __game?: FlagshipSnapshot }).__game;
      return game?.version === 1 && game.scene?.ready === true;
    },
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  return page.evaluate(() => {
    const game = (window as typeof window & { __game?: { getSnapshot?: () => FlagshipSnapshot } }).__game;
    if (!game?.getSnapshot) throw new Error('window.__game.getSnapshot is missing');
    return game.getSnapshot();
  });
}

async function expectBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled({ timeout: WAIT_MS });
  await target.tap();
}

async function visibleTappableActionIds(page: Page): Promise<string[]> {
  return page.locator('button:visible, [role="button"]:visible').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const disabled =
          element.getAttribute('aria-disabled') === 'true' ||
          (element instanceof HTMLButtonElement && element.disabled);
        return !disabled;
      })
      .map((node) => {
        const element = node as HTMLElement;
        return (
          element.dataset.testid ??
          element.dataset.action ??
          element.id ??
          element.getAttribute('aria-label') ??
          element.textContent?.trim() ??
          ''
        );
      })
      .filter(Boolean)
      .sort(),
  );
}

async function playOneRound(page: Page, slot: string, routeChoiceSelector: string): Promise<string[]> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });
  await waitForReady(page);
  await expectBeat(page, 'packet-offered');

  // Player input only: no window.__game.input calls. The harness mirror is read for assertions.
  await tapVisible(page, routeChoiceSelector);
  await tapVisible(page, '#deliverButton');
  await tapVisible(page, '#returnToIoButton');

  await expectBeat(page, 'io-return-recognition');
  await tapVisible(page, '#chooseReturnToneButton');
  await expectBeat(page, 'return-tone-choice');
  await tapVisible(page, '#askForNextJobButton');
  await expectBeat(page, 'io-next-job');

  return visibleTappableActionIds(page);
}

test.describe('M-LOOP divergent available actions', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('two different memory records produce different tappable job actions on the served page', async ({ browser }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const cautiousPage = await browser.newPage();
    const riskyPage = await browser.newPage();

    const cautiousActions = await playOneRound(
      cautiousPage,
      `m-loop-cautious-${runId}`,
      '#skipRouteButton',
    );
    const riskyActions = await playOneRound(
      riskyPage,
      `m-loop-risky-${runId}`,
      '#acknowledgeRouteButton',
    );

    await expect(cautiousPage.locator('body')).toContainText(/job|route|offer/i);
    await expect(riskyPage.locator('body')).toContainText(/job|route|offer/i);

    expect(cautiousActions, 'first memory record must expose at least one tappable next action').not.toEqual([]);
    expect(riskyActions, 'second memory record must expose at least one tappable next action').not.toEqual([]);
    expect(cautiousActions, 'M-LOOP requires element-level action divergence, not dialogue-only variance').not.toEqual(
      riskyActions,
    );

    await cautiousPage.close();
    await riskyPage.close();
  });
});
