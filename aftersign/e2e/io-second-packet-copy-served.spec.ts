import { expect, test } from '@playwright/test';
import { selectIoSecondPacketCopyForReturnReason } from '../src/ioSecondPacketCopy';

const WAIT_MS = 15_000;

const tapChoice = async (page, choiceId: string) => {
  await page.locator(`[data-aftersign-choice="${choiceId}"]`).click();
};

const waitForBeat = async (page, beat: string) => {
  await expect(page.locator('#line')).toHaveAttribute('data-beat-id', beat, {
    timeout: WAIT_MS,
  });
};

const playToSecondPacketOffer = async (page, returnTone: 'kind' | 'evasive' | 'blunt') => {
  await page.goto(`/aftersign/?slot=io-second-packet-${returnTone}-${Date.now()}`);
  await expect(page.locator('#line')).toBeVisible({ timeout: WAIT_MS });

  await page.locator('#packetButton').click();
  await waitForBeat(page, 'packet-choice');
  await tapChoice(page, 'acknowledge-kiosk');
  await tapChoice(page, 'deliver-packet');
  await waitForBeat(page, 'io-return-recognition');

  const toneChoice = returnTone === 'kind'
    ? page.locator('[data-aftersign-choice="choose-return-tone"][data-return-reason="kind"]')
    : returnTone === 'evasive'
      ? page.locator('[data-aftersign-choice="choose-return-tone"][data-return-reason="evasive"]')
      : page.locator('[data-aftersign-choice="choose-return-tone"][data-return-reason="blunt"]');
  await toneChoice.click();
  await waitForBeat(page, 'return-tone-choice');
  await tapChoice(page, 'ask-for-next-job');
  await waitForBeat(page, 'io-next-job');
};

for (const returnTone of ['kind', 'evasive', 'blunt'] as const) {
  test(`Io offers second packet copy on served page after ${returnTone} return`, async ({ page }) => {
    await playToSecondPacketOffer(page, returnTone);

    const copy = selectIoSecondPacketCopyForReturnReason({ returnReason: returnTone });
    const line = page.locator('#line');
    await expect(page.locator('#speaker')).toHaveText(copy.speaker);
    await expect(line).toContainText(copy.lines.join(' '));

    await expect(page.locator(`[data-aftersign-choice="${copy.choices[0].id}"]`)).toHaveText(copy.choices[0].label);
    await expect(page.locator(`[data-aftersign-choice="${copy.choices[1].id}"]`)).toHaveText(copy.choices[1].label);

    await page.locator(`[data-aftersign-choice="${copy.choices[0].id}"]`).click();
    await expect(line).toHaveText(copy.choices[0].response);
  });
}
