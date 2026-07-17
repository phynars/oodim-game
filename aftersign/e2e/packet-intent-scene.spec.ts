import { expect, test } from '@playwright/test';

// Cold-start budget matches other AFTERSIGN e2e specs
// (packet-hold-threshold.spec.ts, flagship-surface-contract.spec.ts, etc.):
// SwiftShader + esm.sh three.js imports on CI regularly exceed Playwright's
// default 30s per-test timeout during the aftersign lane's cold-start.
// Without these overrides this spec races the wall clock instead of the
// scene contract and reports as a false red — the exact pre-existing flake
// two independent reviewers flagged on PR #698 before this bump.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

const waitForGame = async (page) => {
  await page.waitForFunction(
    () => Boolean(window.__game?.input?.packetPress),
    undefined,
    { timeout: WAIT_MS },
  );
};

test('scene exposes packet tap/hold intent through window.__game', async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  await page.goto('/?slot=packet-intent-scene');
  await waitForGame(page);
  await page.evaluate(() => window.__game.resetSliceSave());

  const tapSnapshot = await page.evaluate(async () => {
    const t0 = 1_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetRelease({ timeMs: t0 + 90, x: 24, y: 24 });
    return window.__game.getSnapshot();
  });

  expect(tapSnapshot.packet.sealed).toBe(true);
  // Both sealed and opened outcomes canonicalize to the shared
  // `packet-choice` beat (see aftersign/flagship-beat-migration.js);
  // the outcome-specific assertion lives on packet.sealed and
  // interaction.packetIntent.outcome.
  expect(tapSnapshot.scene.beat).toBe('packet-choice');
  expect(tapSnapshot.interaction.packetIntent.outcome).toBe('sealed');
  expect(tapSnapshot.interaction.packetIntent.progress).toBe(0);

  const holdSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    const t0 = 2_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetTick(t0 + 450);
    return window.__game.getSnapshot();
  });

  expect(holdSnapshot.packet.sealed).toBe(false);
  expect(holdSnapshot.scene.beat).toBe('packet-choice');
  expect(holdSnapshot.interaction.packetIntent.outcome).toBe('opened');
  expect(holdSnapshot.interaction.packetIntent.progress).toBe(1);

  const holdThenReleaseSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    const t0 = 3_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetTick(t0 + 450);
    window.__game.input.packetRelease({ timeMs: t0 + 470, x: 24, y: 24 });
    return window.__game.getSnapshot();
  });

  expect(holdThenReleaseSnapshot.packet.sealed).toBe(false);
  expect(holdThenReleaseSnapshot.scene.beat).toBe('packet-choice');
  expect(holdThenReleaseSnapshot.interaction.packetIntent.outcome).toBe('opened');
  expect(holdThenReleaseSnapshot.interaction.packetIntent.progress).toBe(1);

  const inBetweenHoldSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    const t0 = 4_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetRelease({ timeMs: t0 + 300, x: 24, y: 24 });
    return window.__game.getSnapshot();
  });

  expect(inBetweenHoldSnapshot.packet.sealed).toBe(true);
  expect(inBetweenHoldSnapshot.scene.beat).toBe('packet-choice');
  expect(inBetweenHoldSnapshot.interaction.packetIntent.outcome).toBe('sealed');
  expect(inBetweenHoldSnapshot.interaction.packetIntent.progress).toBe(0);

  const resetSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    return window.__game.getSnapshot();
  });

  expect(resetSnapshot.scene.beat).toBe('packet-offered');
  expect(resetSnapshot.packet.sealed).toBe(true);
  expect(resetSnapshot.packet.delivered).toBe(false);
  expect(resetSnapshot.interaction.packetIntent.outcome).toBe('unknown');
  expect(resetSnapshot.interaction.packetIntent.progress).toBe(0);
});
