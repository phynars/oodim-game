import { expect, test } from "@playwright/test";

type PacketSealState = "sealed" | "opened";

type GameApi = {
  state?: {
    currentBeat?: string;
    beat?: string;
    story?: {
      packetSealState?: PacketSealState;
    };
    packetSealState?: PacketSealState;
  };
  story?: {
    packetSealState?: PacketSealState;
  };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameApi;
  }
}

async function waitForBeat(page: Parameters<typeof test>[0]["page"], beat: string): Promise<void> {
  await page.waitForFunction(
    (expectedBeat) => {
      const game = window.__game;
      const current = game?.state?.currentBeat ?? game?.state?.beat;
      return current === expectedBeat;
    },
    beat,
    { timeout: 10_000 },
  );
}

async function readPacketSealState(page: Parameters<typeof test>[0]["page"]): Promise<PacketSealState | null> {
  return page.evaluate(() => {
    const game = window.__game;
    return (
      game?.state?.story?.packetSealState ??
      game?.state?.packetSealState ??
      game?.story?.packetSealState ??
      null
    );
  });
}

test.describe("packet seal state contract", () => {
  test("starts sealed", async ({ page }) => {
    await page.goto("/aftersign/?slot=packet-seal-contract-start");
    await waitForBeat(page, "packet-offered");

    await expect.poll(() => readPacketSealState(page)).toBe("sealed");
  });

  test("open choice flips packet to opened", async ({ page }) => {
    await page.goto("/aftersign/?slot=packet-seal-contract-open");
    await waitForBeat(page, "packet-offered");

    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");

    await expect.poll(() => readPacketSealState(page)).toBe("opened");
  });

  test("keep sealed + deliver preserves sealed on return", async ({ page }) => {
    const slot = "packet-seal-contract-sealed-return";

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-offered");

    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate(async () => {
      await window.__game!.input.forceSave();
      await window.__game!.input.advance();
    });

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "io-returning-recognition");

    await expect.poll(() => readPacketSealState(page)).toBe("sealed");
  });
});
