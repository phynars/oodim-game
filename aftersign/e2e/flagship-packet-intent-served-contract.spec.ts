import { expect, test } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type PacketIntentProbe = {
  input: {
    packetPress: (input: { timeMs: number; x: number; y: number }) => unknown;
    packetMove: (input: { timeMs: number; x: number; y: number }) => unknown;
    packetRelease: (input: { timeMs: number; x: number; y: number }) => unknown;
    packetTick: (timeMs: number) => unknown;
    waitForStoryIdle?: () => Promise<unknown> | unknown;
  };
  scene: { beat: string; ready: boolean };
  packet: { sealed: boolean };
  interaction: {
    packetIntent: {
      active: boolean;
      progress: number;
      outcome: string;
    };
    packetIntentEvaluation: unknown;
    failureFeedback: { active: boolean; remainingMs: number };
  };
};

const waitForGame = async (page: import("@playwright/test").Page) => {
  await page.goto("/aftersign/?slot=packet-intent-served-contract", { waitUntil: "load" });
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, {
    timeout: WAIT_MS,
  });
  await page.waitForFunction(
    () => typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game?.input?.waitForStoryIdle?.());
};

const readProbe = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const game = window.__game as PacketIntentProbe | undefined;
    if (!game) throw new Error("window.__game was not published");
    return JSON.parse(JSON.stringify({
      scene: game.scene,
      packet: game.packet,
      interaction: game.interaction,
    })) as Omit<PacketIntentProbe, "input">;
  });

test.describe("AFTERSIGN served packet intent feel contract", () => {
  test("fast tap preserves the sealed packet without failure feedback", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await waitForGame(page);

    await page.evaluate(() => {
      const game = window.__game as PacketIntentProbe | undefined;
      if (!game) throw new Error("window.__game was not published");
      game.input.packetPress({ timeMs: 1000, x: 240, y: 520 });
      game.input.packetRelease({ timeMs: 1096, x: 240, y: 520 });
    });
    await page.evaluate(() => window.__game?.input?.waitForStoryIdle?.());

    const probe = await readProbe(page);
    expect(probe.scene.beat).toBe("packet-choice");
    expect(probe.packet.sealed).toBe(true);
    expect(probe.interaction.packetIntent.active).toBe(false);
    expect(probe.interaction.failureFeedback.active).toBe(false);
    expect(probe.interaction.packetIntentEvaluation).not.toBeNull();
  });

  test("deliberate hold opens the packet before release", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await waitForGame(page);

    const openedSnapshot = await page.evaluate(() => {
      const game = window.__game as PacketIntentProbe | undefined;
      if (!game) throw new Error("window.__game was not published");
      game.input.packetPress({ timeMs: 2000, x: 240, y: 520 });
      return game.input.packetTick(2460);
    });
    await page.evaluate(() => window.__game?.input?.waitForStoryIdle?.());

    const probe = await readProbe(page);
    expect(openedSnapshot).toEqual(expect.objectContaining({ outcome: "opened" }));
    expect(probe.scene.beat).toBe("packet-choice");
    expect(probe.packet.sealed).toBe(false);
    expect(probe.interaction.packetIntent.progress).toBeGreaterThanOrEqual(1);
    expect(probe.interaction.failureFeedback.active).toBe(false);
  });

  test("drift cancels into a failure sting and leaves the packet sealed", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await waitForGame(page);

    const cancelledSnapshot = await page.evaluate(() => {
      const game = window.__game as PacketIntentProbe | undefined;
      if (!game) throw new Error("window.__game was not published");
      game.input.packetPress({ timeMs: 3000, x: 240, y: 520 });
      return game.input.packetMove({ timeMs: 3048, x: 272, y: 520 });
    });
    await page.evaluate(() => window.__game?.input?.waitForStoryIdle?.());

    const probe = await readProbe(page);
    expect(cancelledSnapshot).toEqual(expect.objectContaining({ outcome: "cancelled" }));
    expect(probe.scene.beat).toBe("packet-offered");
    expect(probe.packet.sealed).toBe(true);
    expect(probe.interaction.failureFeedback.active).toBe(true);
    expect(probe.interaction.failureFeedback.remainingMs).toBeGreaterThan(0);
  });
});

declare global {
  interface Window {
    __game?: PacketIntentProbe;
  }
}
