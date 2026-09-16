import { test, expect, type Page } from "@playwright/test";

import { type FlagshipGameSurface } from "../../e2e-shared/flagshipStoryStateContract";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
  }
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

test.describe("AFTERSIGN phase 2 input/delivery harness contract", () => {
  test("sealed choice exposes delivery outcome and story-idle helper", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=flagship-phase2-${Date.now()}`, { waitUntil: "load" });
    const initial = await readSurface(page);

    expect(initial.delivery.outcome).toBe("unknown");

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await waitForStoryIdle(page);

    // RACE FIX (PR #1785 review 3, CI red on the sealed-choice spec):
    // `deliverPacket()` in `aftersign/main.js` persists
    // `beat="packet-delivered"` synchronously, THEN schedules a
    // `setBeat("io-return-recognition")` after 1180ms
    // (aftersign/main.js:3809-3810). `waitForStoryIdle` here is
    // `page.evaluate(() => window.__game.input.waitForStoryIdle())` —
    // implemented as 2 rAF frames + publishState (main.js:2905-2908).
    // On a loaded SwiftShader CI runner the CROSS-RPC hops between
    // `choose("deliver-packet")` → `waitForStoryIdle` → `readSurface`
    // can easily exceed 1180ms, so the 1180ms `setBeat` fires before
    // `readSurface` snapshots `scene.beat`, and the spec reads
    // `"io-return-recognition"` instead of `"packet-delivered"` (the
    // exact failure line the CI bot posted on PR #1785).
    //
    // Fix: colocate the delivery + snapshot into a SINGLE `page.evaluate`
    // — same pattern the sibling `npc-memory-roundtrip.spec.ts` uses
    // for the identical race (its file header names the 1180ms window
    // explicitly). No cross-RPC boundary between the beat commit and
    // the read, so the durable beat we assert is deterministic. The
    // `waitForStoryIdle` inside the evaluate runs on the SAME axis as
    // the choose call — same tick budget, no IPC.
    const delivered = await page.evaluate(async () => {
      await window.__game!.input.choose("deliver-packet");
      await window.__game!.input.waitForStoryIdle();
      const g = window.__game!;
      return {
        delivery: { outcome: g.delivery.outcome },
        scene: { beat: g.scene.beat },
      };
    });

    expect(delivered.delivery.outcome).toBe("sealed");
    expect(delivered.scene.beat).toBe("packet-delivered");
  });
});
