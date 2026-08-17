import { expect, test } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function tapVisibleControl(page: import('@playwright/test').Page, label: RegExp | string) {
  const roleButton = page.getByRole('button', { name: label }).first();
  if (await roleButton.isVisible().catch(() => false)) {
    await roleButton.tap();
    return;
  }

  const textControl = page.getByText(label).first();
  await expect(textControl).toBeVisible();
  await textControl.tap();
}

async function expectVisibleBeat(page: import('@playwright/test').Page, beatId: string, text: RegExp | string) {
  await expect.poll(async () => page.evaluate(() => window.__game?.story?.beat ?? window.__game?.storyState?.beat ?? null)).toBe(beatId);
  await expect(page.getByText(text).first()).toBeVisible();
}

test.use({
  viewport: PHONE_VIEWPORT,
  hasTouch: true,
  isMobile: true,
});

test('M-CONTINUE can be played by taps into the next packet loop', async ({ page }) => {
  await page.goto('/');

  await tapVisibleControl(page, /packet/i);
  await expectVisibleBeat(page, 'packet-choice', /blue packet|sealed packet|open/i);

  await tapVisibleControl(page, /keep.*sealed|preserve|do not open/i);
  await tapVisibleControl(page, /route|listen|continue/i);
  await tapVisibleControl(page, /deliver/i);

  await expectVisibleBeat(page, 'packet-delivered', /delivered|sign box|blue seal/i);
  await tapVisibleControl(page, /return|back to io|io/i);
  await expectVisibleBeat(page, 'io-return-recognition', /came back|returned|seal/i);

  await tapVisibleControl(page, /blunt|work|job/i);
  await expectVisibleBeat(page, 'io-return-tone-blunt', /work|job|facts/i);

  await tapVisibleControl(page, /next job|another job|what now/i);
  await expectVisibleBeat(page, 'io-next-job', /Orra|Saint Orra|pharmacy|name/i);

  await tapVisibleControl(page, /deliver next packet|take the packet|start/i);
  await expectVisibleBeat(page, 'packet-choice', /blue packet|sealed packet|open/i);

  await expect(page.getByRole('button', { name: /open/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /keep|sealed|preserve/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /inspect|packet/i }).first()).toBeVisible();
});
