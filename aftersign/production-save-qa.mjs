import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const origin = 'https://game.oodim.com';
const player = `mara-qa-${randomUUID()}`;
const slot = 'save-verification';
const endpoint = `${origin}/aftersign/save/${player}/${slot}`;
const url = `${origin}/aftersign/?player=${player}&slot=${slot}`;
const evidence = { started: new Date().toISOString(), deploymentSHA: null, requests: [], pageErrors: [], checkpoints: [] };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', e => { evidence.pageErrors.push(e.message); console.log('PAGEERROR', e.message); });
page.on('response', r => {
  if (r.url().includes('/aftersign/save/')) {
    const row = { method: r.request().method(), status: r.status() };
    evidence.requests.push(row); console.log('SAVE', JSON.stringify(row));
  }
});
const read = () => page.evaluate(() => {
  const g = window.__game;
  return { beat: g.scene.beat, packet: g.packet, delivery: g.delivery, save: g.save, memory: g.npcs.io.memory, player: { matches: new URLSearchParams(location.search).get('player') === g.player.id } };
});
const beat = id => expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: 60000 });
const choice = id => page.locator(`button[data-choice-id="${id}"]`).first();
async function checkpoint(name) {
  const state = await read(); evidence.checkpoints.push({ name, ...state }); console.log(name, JSON.stringify(state)); return state;
}
async function tapSave(control, target) {
  await expect(control).toBeVisible(); await expect(control).toBeEnabled();
  const [r] = await Promise.all([
    page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'PUT' && r.request().postDataJSON()?.payload?.beat === target),
    control.tap(),
  ]);
  expect(r.ok(), `PUT ${target}: ${r.status()}`).toBe(true);
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
  // Isolated fresh save only: production player's data is never touched.
  const payload = { beat: 'packet-offered', packet: { delivered: false, route: null, sealed: true, deliveredAt: null }, delivery: { outcome: 'unknown' }, player: { id: player, name: null, flags: { io_intro_seen: true } }, memory: [], save: { revision: 0 } };
  const seeded = await context.request.put(endpoint, { data: { payload } });
  evidence.seedStatus = seeded.status(); console.log('SEED', seeded.status());
  expect(seeded.ok()).toBe(true);
  const initial = await context.request.get(endpoint);
  evidence.initialGetStatus = initial.status();
  expect(initial.ok()).toBe(true); expect((await initial.json()).payload).toEqual(payload);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game?.scene?.ready === true);
  evidence.assets = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.src));
  await beat('packet-offered');
  await checkpoint('boot');
  await round('job-safe-delivery');
  await tapSave(page.locator('button[data-return-reason="blunt"]'), 'return-tone-choice');
  await beat('return-tone-choice');
  await tapSave(choice('ask-for-next-job'), 'io-next-job');
  await beat('io-next-job');
  await expect.poll(async () => (await read()).save, { timeout: 60000 }).toMatchObject({ authority: 'server', dirty: false });
  const before = await checkpoint('before-reload');
  expect(before.player.matches).toBe(true);
  expect(before.save.revision).toBe(1);
  expect(before.memory).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'delivery-outcome', object: 'sealed' })]));
  const saved = await context.request.get(endpoint);
  evidence.savedGetStatus = saved.status(); expect(saved.ok()).toBe(true);
  const savedBody = await saved.json();
  expect(savedBody.payload.beat).toBe('io-next-job');
  expect(savedBody.payload.save.revision).toBe(1);
  // Clear cache while preserving explicit test identity to exclude local fallback.
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
  evidence.returningOffers = await tray.locator('button[data-offered-job-id]:visible').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-offered-job-id')).sort());
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
  expect(evidence.requests.every(r => r.status >= 200 && r.status < 300)).toBe(true);
  evidence.result = 'PASS';
} catch (e) {
  evidence.result = 'FAIL'; evidence.error = String(e.stack || e); console.error(evidence.error); process.exitCode = 1;
} finally {
  await page.screenshot({ path: '/tmp/mara-production-save.png' }).catch(() => {});
  await context.close();
  const cleanup = await browser.newContext();
  const deleted = await cleanup.request.delete(endpoint);
  evidence.cleanupDeleteStatus = deleted.status();
  console.log('DELETE', deleted.status());
  if (!deleted.ok()) { evidence.result = 'FAIL'; process.exitCode = 1; }
  await browser.close();
  evidence.finished = new Date().toISOString();
  writeFileSync('/tmp/mara-production-save.json', JSON.stringify(evidence, null, 2));
  console.log('RESULT', evidence.result);
}
