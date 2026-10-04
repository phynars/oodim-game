import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const origin = process.env.AFTERSIGN_PRODUCTION_ORIGIN || 'https://game.oodim.com';
const player = `mara-qa-${randomUUID()}`;
const slot = 'default';
const endpoint = `${origin}/aftersign/save/${player}/${slot}`;
const url = `${origin}/aftersign/?player=${player}&slot=${slot}`;
const evidence = {
  started: new Date().toISOString(),
  deploymentSHA: null,
  requests: [],
  pageErrors: [],
  checkpoints: [],
};
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', error => {
  evidence.pageErrors.push(error.message);
  console.log('PAGEERROR', error.message);
});
page.on('response', response => {
  if (response.url().includes('/aftersign/save/')) {
    const row = { method: response.request().method(), status: response.status() };
    evidence.requests.push(row);
    console.log('SAVE', JSON.stringify(row));
  }
});

const read = () => page.evaluate(() => {
  const game = window.__game;
  return {
    beat: game.scene.beat,
    packet: game.packet,
    delivery: game.delivery,
    save: game.save,
    memory: game.npcs.io.memory,
    player: { matches: new URLSearchParams(location.search).get('player') === game.player.id },
  };
});
const beat = id => expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: 60000 });
const choice = id => page.locator(`button[data-choice-id="${id}"]`).first();

async function checkpoint(name) {
  const state = await read();
  evidence.checkpoints.push({ name, ...state });
  console.log(name, JSON.stringify(state));
  return state;
}

async function tapSave(control, target) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(candidate => (
      candidate.url() === endpoint
      && candidate.request().method() === 'PUT'
      && candidate.request().postDataJSON()?.payload?.beat === target
    )),
    control.tap(),
  ]);
  expect(response.ok(), `PUT ${target}: ${response.status()}`).toBe(true);
}

async function round(job) {
  await page.locator(`[data-offered-job-id="${job}"]`).tap();
  await page.locator('#packetButton').tap();
  await beat('packet-choice');
  await choice('acknowledge-kiosk').tap();
  await tapSave(choice('deliver-packet'), 'packet-delivered');
  await beat('io-return-recognition');
}

try {
  const payload = {
    beat: 'packet-offered',
    packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
    delivery: { outcome: 'unknown' },
    player: { id: player, name: null, flags: { io_intro_seen: true } },
    memory: [],
    save: { revision: 0 },
  };
  const seeded = await context.request.put(endpoint, { data: { payload } });
  evidence.seedStatus = seeded.status();
  console.log('SEED', seeded.status());
  expect(seeded.ok()).toBe(true);

  const initial = await context.request.get(endpoint);
  evidence.initialGetStatus = initial.status();
  expect(initial.ok()).toBe(true);
  expect((await initial.json()).payload).toEqual(payload);

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game?.scene?.ready === true);
  evidence.assets = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
  await beat('packet-offered');
  await checkpoint('boot');
  await round('job-safe-delivery');
  await tapSave(page.locator('button[data-return-reason="blunt"]'), 'return-tone-choice');
  await beat('return-tone-choice');
  await tapSave(choice('ask-for-next-job'), 'io-next-job');
  await beat('io-next-job');
  await expect.poll(async () => (await read()).save, { timeout: 60000 }).toMatchObject({
    slot,
    authority: 'server',
    dirty: false,
  });

  const before = await checkpoint('before-reload');
  expect(before.player.matches).toBe(true);
  expect(before.save.revision).toBe(1);
  expect(before.memory).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'delivery-outcome', object: 'sealed' }),
  ]));

  const saved = await context.request.get(endpoint);
  evidence.savedGetStatus = saved.status();
  expect(saved.ok()).toBe(true);
  const savedBody = await saved.json();
  expect(savedBody.payload.beat).toBe('io-next-job');
  expect(savedBody.payload.save.revision).toBe(1);

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await beat('io-next-job');
  const after = await checkpoint('after-reload');
  expect(after.save.revision).toBe(before.save.revision);
  expect(after.delivery.outcome).toBe(before.delivery.outcome);
  expect(after.memory).toEqual(expect.arrayContaining(before.memory));

  await choice('deliver-packet').tap();
  await beat('packet-offered');
  const tray = page.locator('#offeredJobs');
  await expect(tray).toHaveAttribute('data-mloop-divergence-memory', 'completed');
  evidence.returningOffers = await tray.locator('button[data-offered-job-id]:visible').evaluateAll(nodes => (
    nodes.map(node => node.getAttribute('data-offered-job-id')).sort()
  ));
  expect(evidence.returningOffers).toEqual(['job-night-transfer', 'job-signed-receipt']);
  await round('job-signed-receipt');
  await expect.poll(async () => (await read()).save.revision, { timeout: 60000 }).toBe(2);

  const roundTwo = await checkpoint('round-two-delivered');
  const roundTwoSaved = await context.request.get(endpoint);
  evidence.roundTwoGetStatus = roundTwoSaved.status();
  expect(roundTwoSaved.ok()).toBe(true);
  const roundTwoBody = await roundTwoSaved.json();
  expect(roundTwo.save.revision).toBe(2);
  expect(roundTwoBody.payload.save.revision).toBe(2);
  expect(roundTwoBody.payload.beat).toBe('packet-delivered');
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.requests.every(request => request.status >= 200 && request.status < 300)).toBe(true);

  evidence.result = 'PASS';
} catch (error) {
  evidence.result = 'FAIL';
  evidence.error = error instanceof Error ? error.stack || error.message : String(error);
  console.error('RESULT FAIL', evidence.error);
  process.exitCode = 1;
} finally {
  // Capture a screenshot before closing the context — a failing run's
  // final frame is the single most useful artifact for triage.
  await page.screenshot({ path: '/tmp/mara-production-save.png' }).catch(() => {});
  await context.close();
  // Isolated cleanup: tear down the per-run save record so repeated
  // runs against production don't orphan a DO per invocation. A fresh
  // context avoids reusing any auth/cookie state from the test session.
  // The DELETE route is handled by apps/web/src/aftersign/authoritativeSaveBackend.ts
  // and returns 204 on success (idempotent — 204 even if already absent).
  const cleanup = await browser.newContext();
  try {
    const deleted = await cleanup.request.delete(endpoint);
    evidence.cleanupDeleteStatus = deleted.status();
    console.log('DELETE', deleted.status());
    if (!deleted.ok()) {
      evidence.result = 'FAIL';
      process.exitCode = 1;
    }
  } catch (cleanupError) {
    evidence.cleanupDeleteStatus = 0;
    evidence.cleanupError = cleanupError instanceof Error
      ? cleanupError.stack || cleanupError.message
      : String(cleanupError);
    evidence.result = 'FAIL';
    process.exitCode = 1;
    console.error('DELETE FAIL', evidence.cleanupError);
  } finally {
    await cleanup.close();
  }
  await browser.close();
  evidence.finished = new Date().toISOString();
  writeFileSync('/tmp/mara-production-save.json', JSON.stringify(evidence, null, 2));
  console.log('RESULT', evidence.result);
}
