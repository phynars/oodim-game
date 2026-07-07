import { test, expect, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type Beat = "packet-offered" | "packet-kept-sealed" | "packet-opened";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  packet: { sealed: boolean };
  interaction: {
    packetIntent: {
      active: boolean;
      outcome: "unknown" | "sealed" | "opened";
      progress: number;
    };
  };
  input: {
    packetPress(input: { timeMs: number; x: number; y: number }): Promise<void>;
    packetTick(timeMs: number): Promise<void>;
    packetRelease(input: { timeMs: number; x: number; y: number }): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

test.describe("AFTERSIGN packet hold-to-open contract", () => {
  test("short tap stays sealed; sustained hold flips to opened while held", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "packet-hold-threshold");

    await page.goto(`/aftersign/?slot=packet-hold-${Date.now()}`, { waitUntil: "load" });
    await waitForGame(page);

    const shortTap = await page.evaluate(() => {
      const g = window.__game!;
      const start = 1_000;
      g.input.packetPress({ timeMs: start, x: 120, y: 120 });
      g.input.packetRelease({ timeMs: start + 120, x: 120, y: 120 });
      return {
        beat: g.scene.beat,
        sealed: g.packet.sealed,
        outcome: g.interaction.packetIntent.outcome,
      };
    });

    expect(shortTap.sealed).toBe(true);
    expect(shortTap.beat).not.toBe("packet-opened");
    expect(shortTap.outcome).toBe("sealed");

    const hold = await page.evaluate(() => {
      const g = window.__game!;
      const start = 4_000;
      g.input.packetPress({ timeMs: start, x: 140, y: 140 });

      g.input.packetTick(start + 180);
      const beforeThreshold = {
        beat: g.scene.beat,
        sealed: g.packet.sealed,
        outcome: g.interaction.packetIntent.outcome,
      };

      g.input.packetTick(start + 2_000);
      const afterThreshold = {
        beat: g.scene.beat,
        sealed: g.packet.sealed,
        outcome: g.interaction.packetIntent.outcome,
      };

      g.input.packetRelease({ timeMs: start + 2_020, x: 140, y: 140 });
      return { beforeThreshold, afterThreshold };
    });

    expect(hold.beforeThreshold.sealed).toBe(true);
    expect(hold.beforeThreshold.beat).not.toBe("packet-opened");
    expect(hold.beforeThreshold.outcome).toBe("unknown");

    expect(hold.afterThreshold.sealed).toBe(false);
    expect(hold.afterThreshold.beat).toBe("packet-opened");
    expect(hold.afterThreshold.outcome).toBe("opened");
  });
});
