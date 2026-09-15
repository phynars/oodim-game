import { expect, test } from "@playwright/test";

const waitForReady = async (page) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__game?.scene?.ready)).toBe(true);
};

test("a real drag-cancel couples the 180ms visual sting to a failure audio cue", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForReady(page);

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible();
  const box = await packet.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("packet button has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 34, y, { steps: 3 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__game?.interaction?.lastAction)).toBe("packet-cancelled");
  await expect.poll(() => page.evaluate(() => window.__game?.interaction?.failureFeedback?.active)).toBe(true);

  const coupled = await page.evaluate(() => ({
    durationMs: window.__game?.interaction?.failureFeedback?.durationMs,
    flashOpacity: Number(document.querySelector(".failure-sting")?.style.opacity ?? 0),
    audioCue: window.__game?._runtime?.audio?.lastCue,
    audioCueAt: window.__game?._runtime?.audio?.lastCueAt,
  }));

  expect(coupled.durationMs).toBe(180);
  expect(coupled.flashOpacity).toBeGreaterThan(0);
  expect(coupled.audioCue).toBe("packet-cancelled");
  expect(coupled.audioCueAt).toEqual(expect.any(Number));

  await expect.poll(() => page.evaluate(() => window.__game?.interaction?.failureFeedback?.active)).toBe(false);
});
