import { expect, test, type Page } from '@playwright/test';

import { selectIoSecondPacketCopyForReturnReason, type IoReturnReason } from '../src/ioSecondPacketCopy.ts';

const WAIT_MS = 15_000;

type ReturnToneCase = {
  readonly reason: IoReturnReason;
  readonly slotPrefix: string;
};

const RETURN_TONE_CASES: readonly ReturnToneCase[] = [
  { reason: 'kind', slotPrefix: 'second-packet-kind' },
  { reason: 'evasive', slotPrefix: 'second-packet-evasive' },
  { reason: 'blunt', slotPrefix: 'second-packet-blunt' },
];

const beat = (page: Page) => page.locator('#line');
const speaker = (page: Page) => page.locator('#speaker');

async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beatId);
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-aftersign-choice="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: IoReturnReason): Promise<void> {
  const choice = page.locator(`button[data-return-reason="${reason}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function playToSecondPacket(page: Page, slot: string, reason: IoReturnReason): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`);
  await waitForReady(page);

  await tapChoice(page, 'packet');
  await waitForBeat(page, 'packet-choice');

  await tapChoice(page, 'acknowledge-kiosk');
  await tapChoice(page, 'deliver-packet');
  await waitForBeat(page, 'io-return-recognition');

  await tapReturnReason(page, reason);
  await waitForBeat(page, 'return-tone-choice');

  await tapChoice(page, 'ask-for-next-job');
  await waitForBeat(page, 'io-next-job');
}

test.describe('Io second-packet copy on the served page', () => {
  for (const { reason, slotPrefix } of RETURN_TONE_CASES) {
    test(`renders the ${reason} return-tone second-packet copy after the handoff`, async ({ page }) => {
      const slot = `${slotPrefix}-${Date.now()}`;
      const expected = selectIoSecondPacketCopyForReturnReason({ returnReason: reason });
      const expectedLine = expected.lines.join(' ');

      await playToSecondPacket(page, slot, reason);

      await expect(speaker(page)).toHaveText(expected.speaker, { timeout: WAIT_MS });
      await expect(beat(page)).toContainText(expectedLine, { timeout: WAIT_MS });
      await expect
        .poll(
          () => page.evaluate(() => window.__game?.npcs?.io?.lastLine),
          { timeout: WAIT_MS },
        )
        .toContain(expectedLine);

      await expect(page.locator(`button[data-aftersign-choice="${expected.choices[0].id}"]`)).toHaveText(expected.choices[0].label);
      await expect(page.locator(`button[data-aftersign-choice="${expected.choices[1].id}"]`)).toHaveText(expected.choices[1].label);
    });
  }
});
