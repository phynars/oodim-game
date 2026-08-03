import { expect, test, type Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type PacketOutcome = "unknown" | "sealed" | "opened" | "cancelled";

type PacketIntentSnapshot = {
  active: boolean;
  progress: number;
  outcome: PacketOutcome;
  config: {
    HOLD_TO_OPEN_MS: number;
    DRIFT_CANCEL_PX: number;
  };
};

type PacketFeelSurface = {
  version: 1;
  scene: { ready: boolean; beat: string };
  packet: { sealed: boolean; delivered: boolean };
  delivery: { outcome: PacketOutcome };
  interaction: {
    failureStartedAt: number | null;
    packetIntent: PacketIntentSnapshot;
  };
  input: {
    choose(choiceId: string): Promise<void>;
    packetPress(input: { timeMs: number; x: number; y: number }): PacketIntentSnapshot;
    packetMove(input: { timeMs: number; x: number; y: number }): PacketIntentSnapshot;
    packetRelease(input: { timeMs: number; x: number; y: number }): PacketIntentSnapshot;
    packetTick(timeMs: number): PacketIntentSnapshot;
    waitForStoryIdle(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: PacketFeelSurface;
  }
}

async function bootServedSlice(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game.scene.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

test.describe("AFTERSIGN packet-intent served-page feel", () => {
  test.beforeEach(({ page }) => {
    test.setTimeout(COLD_START_MS);
    page.on("pageerror", (error) => {
      // eslint-disable-next-line no-console
      console.error("[aftersign packet-intent-served-page-feel] pageerror:", error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        // eslint-disable-next-line no-console
        console.error("[aftersign packet-intent-served-page-feel] console.error:", message.text());
      }
    });
  });

  test("quick tap preserves the seal before delivery", async ({ page }) => {
    await bootServedSlice(page, `packet-intent-tap-${Date.now()}`);

    const result = await page.evaluate(async () => {
      const game = window.__game;
      if (!game) throw new Error("window.__game missing after boot");

      const start = { timeMs: 1_000, x: 120, y: 140 };
      const released = game.input.packetRelease({
        ...start,
        timeMs: start.timeMs + 120,
      });
      game.input.packetPress(start);
      const tap = game.input.packetRelease({
        ...start,
        timeMs: start.timeMs + 120,
      });
      await game.input.choose("deliver-packet");
      await game.input.waitForStoryIdle();

      return {
        prePressRelease: released,
        tap,
        beat: window.__game?.scene.beat,
        sealed: window.__game?.packet.sealed,
        delivered: window.__game?.packet.delivered,
        outcome: window.__game?.delivery.outcome,
      };
    });

    expect(result.prePressRelease.outcome).toBe("unknown");
    expect(result.tap.outcome).toBe("sealed");
    expect(result.tap.progress).toBe(0);
    expect(result.beat).toBe("packet-delivered");
    expect(result.sealed).toBe(true);
    expect(result.delivered).toBe(true);
    expect(result.outcome).toBe("sealed");
  });

  test("a committed hold opens the packet on the served page at the live controller threshold", async ({ page }) => {
    await bootServedSlice(page, `packet-intent-hold-${Date.now()}`);

    const result = await page.evaluate(async () => {
      const game = window.__game;
      if (!game) throw new Error("window.__game missing after boot");

      const start = { timeMs: 2_000, x: 160, y: 180 };
      const pressed = game.input.packetPress(start);
      const opened = game.input.packetTick(start.timeMs + pressed.config.HOLD_TO_OPEN_MS);
      await game.input.choose("deliver-packet");
      await game.input.waitForStoryIdle();

      return {
        holdMs: pressed.config.HOLD_TO_OPEN_MS,
        configuredHoldMs: pressed.config.HOLD_TO_OPEN_MS,
        opened,
        beat: window.__game?.scene.beat,
        sealed: window.__game?.packet.sealed,
        delivered: window.__game?.packet.delivered,
        outcome: window.__game?.delivery.outcome,
      };
    });

    expect(result.configuredHoldMs).toBe(result.holdMs);
    expect(result.opened.outcome).toBe("opened");
    expect(result.opened.progress).toBe(1);
    expect(result.beat).toBe("packet-delivered");
    expect(result.sealed).toBe(false);
    expect(result.delivered).toBe(true);
    expect(result.outcome).toBe("opened");
  });

  test("drag cancel exposes the failed intent without mutating the packet outcome", async ({ page }) => {
    await bootServedSlice(page, `packet-intent-cancel-${Date.now()}`);

    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) throw new Error("window.__game missing after boot");

      const start = { timeMs: 3_000, x: 210, y: 230 };
      const pressed = game.input.packetPress(start);
      const cancelled = game.input.packetMove({
        ...start,
        timeMs: start.timeMs + 80,
        x: start.x + pressed.config.DRIFT_CANCEL_PX + 8,
      });

      return {
        cancelled,
        beat: window.__game?.scene.beat,
        sealed: window.__game?.packet.sealed,
        delivered: window.__game?.packet.delivered,
        outcome: window.__game?.delivery.outcome,
        failureStartedAt: window.__game?.interaction.failureStartedAt ?? null,
      };
    });

    expect(result.cancelled.outcome).toBe("cancelled");
    expect(result.cancelled.active).toBe(false);
    expect(result.beat).toBe("packet-offered");
    expect(result.sealed).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.outcome).toBe("unknown");
    expect(result.failureStartedAt).not.toBeNull();
  });

  test("the served page exposes packet intent progress for inspectable hold affordance", async ({ page }) => {
    await bootServedSlice(page, `packet-intent-inspect-${Date.now()}`);

    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) throw new Error("window.__game missing after boot");

      const start = { timeMs: 4_000, x: 260, y: 280 };
      const pressed = game.input.packetPress(start);
      const halfway = game.input.packetTick(start.timeMs + Math.round(pressed.config.HOLD_TO_OPEN_MS / 2));
      return {
        pressed,
        halfway,
        published: window.__game?.interaction.packetIntent,
        cssProgress: document.documentElement.style.getPropertyValue("--packet-progress"),
      };
    });

    expect(result.pressed.active).toBe(true);
    expect(result.halfway.active).toBe(true);
    expect(result.halfway.outcome).toBe("unknown");
    expect(result.halfway.progress).toBeGreaterThan(0.4);
    expect(result.halfway.progress).toBeLessThan(0.7);
    expect(result.published.progress).toBeCloseTo(result.halfway.progress, 2);
    expect(Number(result.cssProgress)).toBeCloseTo(result.halfway.progress, 2);
  });
});
