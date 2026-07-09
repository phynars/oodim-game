// Reload-beat regression harness for the AFTERSIGN vertical slice.
//
// What it guards (impl at aftersign/index.html, publishState()):
//   • deliverPacket() persists with beat="packet-delivered" SYNCHRONOUSLY,
//     then schedules a setBeat("io-returning-recognition") after 1180ms.
//     The persisted beat we reload from is "packet-delivered" — that's
//     the durable one; the returning-line beat is a live-session
//     animation, not a save-state.
//   • state.npcs.io.memory (SINGULAR) is the field publishState exposes.
//     There is no plural `memories` — asserting on it would read undefined
//     and pass silently even after a regression. The shared contract
//     (e2e-shared/flagshipStoryStateContract.ts) uses `memories`, but that
//     surface is `test.fixme`'d until Phase 3 (#566) lands the rename.
//     Until then this spec asserts against the LIVE shape.
//
// Guard is state-quiesced (waitForFunction + waitForStoryIdle) — no
// waitForTimeout, per e2e-shared/no-wall-clock-waits.
import { expect, test, type Page } from "@playwright/test";

// Narrow local Window.__game shape covering only the four fields this
// spec touches. Global augmentations in TypeScript merge across files,
// but Playwright's per-file esbuild transpile strips types — so runtime
// is unaffected. The narrow type keeps this file self-contained without
// pulling the full FlagshipGameSurface.
declare global {
  interface Window {
    __game?: {
      scene: { beat: string };
      input: {
        choose: (choiceId: string) => void | Promise<void>;
        forceSave: () => void | Promise<void>;
        forceReload: () => void | Promise<void>;
        waitForStoryIdle: () => void | Promise<void>;
      };
      getSnapshot: () => {
        scene: { beat: string };
        npcs: { io: { lastLine?: string | null; memory: Array<{ id?: string }> } };
        delivery: { outcome: string };
      };
    };
  }
}

const WAIT_MS = 10_000;

async function waitForSurface(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function" &&
      typeof window.__game?.input?.choose === "function" &&
      typeof window.__game?.input?.forceSave === "function" &&
      typeof window.__game?.input?.forceReload === "function" &&
      typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
}

async function idle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

test.describe("AFTERSIGN reload beat regression", () => {
  test("keeps the sealed packet beat readable after save/load", async ({ page }) => {
    await page.goto("./");
    await waitForSurface(page);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await idle(page);
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await idle(page);
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.evaluate(() => window.__game!.input.forceReload());
    await idle(page);

    const afterReload = await page.evaluate(() => window.__game!.getSnapshot());

    // Live impl (aftersign/index.html):
    //   • deliverPacket() persists with beat="packet-delivered" synchronously,
    //     then advances to "io-returning-recognition" ~1180ms later. The saved
    //     beat we reload from is "packet-delivered".
    //   • npcs.io.memory is the singular array field. There is no plural
    //     `memories` — asserting on it would always be undefined.
    expect(afterReload.delivery.outcome).toBe("sealed");
    expect(afterReload.scene.beat).toBe("packet-delivered");
    expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
    expect(afterReload.npcs.io.lastLine ?? "").not.toContain(
      "Touch the blue kiosk when you're ready",
    );
  });
});
