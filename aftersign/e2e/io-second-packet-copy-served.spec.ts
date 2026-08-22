import { expect, test, type Page } from '@playwright/test';
import { selectIoSecondPacketCopyForReturnReason, type IoReturnReason } from '../src/ioSecondPacketCopy';

const PHONE_VIEWPORT = { width: 390, height: 844 };

test.use({ hasTouch: true, viewport: PHONE_VIEWPORT });

const RETURN_TONE_BUTTON: Record<IoReturnReason, string> = {
  kind: '#acknowledgeRouteButton',
  evasive: '#skipRouteButton',
  blunt: '#deliverButton',
};

async function bootFreshPhoneSlice(page: Page, slot: string) {
  await page.goto(`/aftersign/?slot=${slot}`);
  await page.waitForFunction(() => window.__game?.scene?.ready === true);
  await page.evaluate(async () => {
    await window.__game.resetSliceSave();
  });
  await expect(page.locator('#line')).toBeVisible();
}

async function tapChoice(page: Page, selector: string, expectedChoiceId: string) {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('data-choice-id', expectedChoiceId);
  await button.tap();
}

async function reachPacketChoice(page: Page) {
  const packetButton = page.locator('#packetButton');
  await expect(packetButton).toBeVisible();
  await expect(packetButton).toBeEnabled();
  await packetButton.tap();
  await page.waitForFunction(() => window.__game?.scene?.beat === 'packet-choice');
  await expect(page.locator('#routeChoice')).toHaveAttribute('data-visible', 'true');
}

async function playToSecondPacketOffer(page: Page, returnReason: IoReturnReason) {
  await reachPacketChoice(page);
  await tapChoice(page, '#acknowledgeRouteButton', 'acknowledge-kiosk');
  await tapChoice(page, '#deliverButton', 'deliver-packet');
  await page.waitForFunction(() => window.__game?.scene?.beat === 'io-return-recognition');
  await tapChoice(page, RETURN_TONE_BUTTON[returnReason], 'choose-return-tone');
  await page.waitForFunction(() => window.__game?.scene?.beat === 'return-tone-choice');
  await tapChoice(page, '#deliverButton', 'ask-for-next-job');
  await page.waitForFunction(() => window.__game?.scene?.beat === 'io-next-job');
}

for (const returnReason of ['kind', 'evasive', 'blunt'] as const) {
  test(`Io speaks ${returnReason} second-packet copy on the served page`, async ({ page }) => {
    const slot = `io-second-packet-copy-${returnReason}-${Date.now()}`;
    await bootFreshPhoneSlice(page, slot);
    await playToSecondPacketOffer(page, returnReason);

    const expected = selectIoSecondPacketCopyForReturnReason({
      returnReason,
      playerName: null,
    });
    const expectedLine = expected.lines.join(' ');

    await expect(page.locator('#speaker')).toHaveText(expected.speaker);
    await expect(page.locator('#line')).toContainText(expectedLine);
    await expect(page.locator('#acknowledgeRouteButton')).toHaveText(expected.choices[0].label);
    await expect(page.locator('#acknowledgeRouteButton')).toHaveAttribute(
      'data-choice-id',
      expected.choices[0].id,
    );
    await expect(page.locator('#skipRouteButton')).toHaveText(expected.choices[1].label);
    await expect(page.locator('#skipRouteButton')).toHaveAttribute(
      'data-choice-id',
      expected.choices[1].id,
    );

    const surface = await page.evaluate(() => ({
      beat: window.__game.scene.beat,
      returnReason: window.__game.player.returnReason,
      lastLine: window.__game.npcs.io.lastLine,
    }));
    expect(surface).toMatchObject({
      beat: 'io-next-job',
      returnReason,
    });
    expect(surface.lastLine).toContain(expectedLine);
  });
}
