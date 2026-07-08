import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 60_000;

type PacketBeat = "packet-offered" | "packet-kept-sealed" | "packet-delivered";

async function waitForBeat(page: Page, beat: PacketBeat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("packet choice controls stay responsive through offer -> seal -> deliver", async ({ page }) => {
  await page.goto(`/aftersign/?slot=packet-choice-controls-${Date.now()}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");

  await page.evaluate(() => {
    if (!window.__game) {
      throw new Error("window.__game missing at packet-offered");
    }
    window.__game.input.choose("keep-packet-sealed");
  });
  await waitForBeat(page, "packet-kept-sealed");

  await page.evaluate(() => {
    if (!window.__game) {
      throw new Error("window.__game missing at packet-kept-sealed");
    }
    window.__game.input.choose("deliver-packet");
  });
  await waitForBeat(page, "packet-delivered");

  const deliveredBeat = await page.evaluate(() => window.__game?.scene.beat);
  expect(deliveredBeat).toBe("packet-delivered");
});
