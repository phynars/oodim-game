import { expect, test, type Page } from '@playwright/test';

type DivergenceSeed = {
  playerId: string;
  memory: Record<string, unknown>;
};

const SAFE_COURIER: DivergenceSeed = {
  playerId: 'soren-m-loop-safe-courier',
  memory: {
    trustPosture: 'new',
    completedJobs: 0,
    avoidedRisk: true,
  },
};

const TRUSTED_COURIER: DivergenceSeed = {
  playerId: 'soren-m-loop-trusted-courier',
  memory: {
    trustPosture: 'trusted',
    completedJobs: 3,
    tookDarkCut: true,
  },
};

async function seedDivergentSave(page: Page, seed: DivergenceSeed) {
  await page.addInitScript(({ playerId, memory }) => {
    const save = {
      playerId,
      facts: memory,
      updatedAt: new Date('2026-08-28T00:00:00.000Z').toISOString(),
    };

    window.localStorage.setItem('aftersign:player-id', playerId);
    window.localStorage.setItem(`aftersign:memory:${playerId}`, JSON.stringify(save));
  }, seed);
}

async function bootAftersignWithSeed(page: Page, seed: DivergenceSeed) {
  await seedDivergentSave(page, seed);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/aftersign/');

  await expect(page.locator('body')).toBeVisible();
}

async function playByTapsUntilJobOffers(page: Page) {
  const actionButtons = page.getByRole('button').filter({ hasNotText: /^$/ });

  for (let step = 0; step < 24; step += 1) {
    const jobOffers = page.locator('[data-job-offer], [data-action-kind="job-offer"]');
    if ((await jobOffers.count()) > 0) {
      return jobOffers;
    }

    const visibleButtons = await actionButtons.all();
    let tapped = false;
    for (const button of visibleButtons) {
      if (await button.isVisible()) {
        await button.tap();
        tapped = true;
        break;
      }
    }

    if (!tapped) {
      break;
    }
  }

  return page.locator('[data-job-offer], [data-action-kind="job-offer"]');
}

async function visibleActionKeys(locator: ReturnType<Page['locator']>) {
  const keys: string[] = [];
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const offer = locator.nth(index);
    if (!(await offer.isVisible())) {
      continue;
    }

    keys.push(
      (await offer.getAttribute('data-action-id')) ??
        (await offer.getAttribute('data-job-offer')) ??
        (await offer.textContent())?.trim() ??
        `offer-${index}`,
    );
  }

  return keys.sort();
}

test.describe('AFTERSIGN M-LOOP divergence playtest', () => {
  test('two different memory records produce different tappable job offers', async ({ page }) => {
    await bootAftersignWithSeed(page, SAFE_COURIER);
    const safeOffers = await visibleActionKeys(await playByTapsUntilJobOffers(page));

    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());

    await bootAftersignWithSeed(page, TRUSTED_COURIER);
    const trustedOffers = await visibleActionKeys(await playByTapsUntilJobOffers(page));

    expect(safeOffers.length, 'first-time courier should see at least one tappable job offer').toBeGreaterThan(0);
    expect(trustedOffers.length, 'trusted courier should see at least one tappable job offer').toBeGreaterThan(0);
    expect(trustedOffers, 'memory must change available actions, not only dialogue').not.toEqual(safeOffers);
  });
});
