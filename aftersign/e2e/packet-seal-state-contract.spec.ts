import { expect, test, type Page } from "@playwright/test";

// The real game surface exposes `packet.sealed: boolean` and `scene.beat`
// via publishState() in aftersign/index.html. This spec asserts the
// packet-seal invariants through THAT surface — no fabricated keys.

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  packet: { sealed: boolean };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function readSealed(page: Page): Promise<boolean | null> {
  return page.evaluate(() => window.__game?.packet.sealed ?? null);
}

test.describe("packet seal state contract", () => {
  test("starts sealed", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=packet-seal-contract-start-${Date.now()}`);
    await waitForBeat(page, "packet-offered");

    expect(await readSealed(page)).toBe(true);
  });

  test("open choice flips packet to opened", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=packet-seal-contract-open-${Date.now()}`);
    await waitForBeat(page, "packet-offered");

    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-choice");

    expect(await readSealed(page)).toBe(false);
  });

  test("keep sealed + deliver preserves sealed on return", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `packet-seal-contract-sealed-return-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-offered");

    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    // Persist the delivered state, then reload so we start from the save.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-delivered");

    // AFTER the reload, advance into the returning recognition beat.
    // Doing this before the reload would be dropped by the save restore.
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-return-recognition");

    expect(await readSealed(page)).toBe(true);
  });
});
