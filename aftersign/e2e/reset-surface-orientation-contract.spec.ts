import { test, expect } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type OrientationSnapshot = {
  beat?: unknown;
  ready?: unknown;
  player?: {
    x?: unknown;
    z?: unknown;
    facingRadians?: unknown;
    flags?: Record<string, unknown>;
  };
  cameraRig?: unknown;
};

async function readOrientationSnapshot(page: import("@playwright/test").Page): Promise<OrientationSnapshot> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __game?: unknown }).__game),
    undefined,
    { timeout: WAIT_MS },
  );

  return page.evaluate(() => {
    const game = (window as unknown as {
      __game?: {
        scene?: { beat?: unknown; ready?: unknown };
        player?: { x?: unknown; z?: unknown; facingRadians?: unknown; flags?: Record<string, unknown> };
        cameraRig?: unknown;
      };
    }).__game;

    return JSON.parse(JSON.stringify({
      beat: game?.scene?.beat,
      ready: game?.scene?.ready,
      player: game?.player,
      cameraRig: game?.cameraRig,
    })) as OrientationSnapshot;
  });
}

test.describe("AFTERSIGN reset orientation contract", () => {
  test("resetSliceSave returns the player to the same kiosk-facing boot pose", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `reset-orientation-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    const boot = await readOrientationSnapshot(page);
    expect(boot.ready).toBe(true);
    expect(boot.beat).toBe("packet-offered");
    expect(boot.player).toMatchObject({
      x: -1.8,
      z: 1.15,
      facingRadians: Math.PI,
    });

    await page.evaluate(async () => {
      const game = (window as unknown as {
        __game?: { resetSliceSave?: () => Promise<void> };
      }).__game;
      await game?.resetSliceSave?.();
    });

    const reset = await readOrientationSnapshot(page);
    expect(reset.ready).toBe(true);
    expect(reset.beat).toBe("packet-offered");
    expect(reset.player).toMatchObject({
      x: -1.8,
      z: 1.15,
      facingRadians: Math.PI,
    });
    expect(reset.player?.flags?.io_intro_seen).toBe(true);
  });

  test("resetSliceSave keeps Io past first-meeting so next-job dialogue cites durable memory", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `reset-memory-dialogue-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, { timeout: WAIT_MS });

    await page.evaluate(async () => {
      await window.__game.resetSliceSave();
      await window.__game.input.choose("keep-sealed");
      await window.__game.input.choose("acknowledge-kiosk");
      await window.__game.input.choose("deliver-packet");
      await new Promise((resolve) => setTimeout(resolve, 1250));
      await window.__game.input.choose("choose-return-tone");
      await window.__game.input.choose("ask-for-next-job");
      await window.__game.input.waitForStoryIdle();
    });

    const game = await page.evaluate(() => window.__game.getSnapshot());

    expect(game.scene.beat).toBe("io-next-job");
    expect(game.player.flags.io_intro_seen).toBe(true);
    expect(game.npcs.io.lastLine).toContain(
      "Last time, you kept the blue packet sealed. I noticed the restraint.",
    );
    expect(game.npcs.io.lastLine).toContain(
      "And you checked the kiosk twice. Most couriers pretend the second signal is static.",
    );
    expect(game.npcs.io.lastLine).not.toContain(
      "You came back before I knew your name. That counts for something.",
    );
  });
});
