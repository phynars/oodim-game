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

// Narrow local Window.__game shape covering only the fields this spec touches.
// Global augmentations in TypeScript merge across files, but Playwright's
// per-file esbuild transpile strips types — so runtime is unaffected. The
// narrow type keeps this file self-contained without pulling the full
// FlagshipGameSurface.
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
        npcs: {
          io: {
            lastLine?: string | null;
            lastLineMemoryRefs?: string[];
            memory: Array<{ id?: string; object?: string; action?: string }>;
          };
        };
        delivery: { outcome: string };
      };
    };
  }
}

const WAIT_MS = 10_000;
const SEALED_LINE = "You came back. So did the blue seal, unbroken. That gives me two facts to trust.";
const OPENED_LINE = "You came back. The seal did not. I can use one of those facts.";

type PacketPath = {
  name: string;
  choices: string[];
  expectedOutcome: "sealed" | "opened";
  expectedLine: string;
  wrongLine: string;
};

const PACKET_PATHS: PacketPath[] = [
  {
    name: "sealed packet",
    choices: ["keep-sealed", "deliver-packet"],
    expectedOutcome: "sealed",
    expectedLine: SEALED_LINE,
    wrongLine: OPENED_LINE,
  },
  {
    name: "opened packet",
    choices: ["open-packet", "deliver-packet"],
    expectedOutcome: "opened",
    expectedLine: OPENED_LINE,
    wrongLine: SEALED_LINE,
  },
];

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

async function playSaveReloadPath(page: Page, path: PacketPath) {
  await page.goto("./");
  await waitForSurface(page);

  for (const choice of path.choices) {
    await page.evaluate((choiceId) => window.__game!.input.choose(choiceId), choice);
    await idle(page);
  }

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.evaluate(() => window.__game!.input.forceReload());
  await idle(page);

  return page.evaluate(() => window.__game!.getSnapshot());
}

test.describe("AFTERSIGN reload beat regression", () => {
  for (const path of PACKET_PATHS) {
    test(`reloads the ${path.name} outcome into Io's correct remembered line`, async ({ page }) => {
      const afterReload = await playSaveReloadPath(page, path);

      // Live impl (aftersign/index.html):
      //   • deliverPacket() persists with beat="packet-delivered" synchronously,
      //     then advances to "io-returning-recognition" ~1180ms later. The saved
      //     beat we reload from is "packet-delivered".
      //   • npcs.io.memory is the singular array field. There is no plural
      //     `memories` — asserting on it would always be undefined.
      expect(afterReload.delivery.outcome).toBe(path.expectedOutcome);
      expect(afterReload.scene.beat).toBe("packet-delivered");
      expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
      expect(afterReload.npcs.io.memory.some((memory) => memory.object === path.expectedOutcome)).toBe(true);
      expect(afterReload.npcs.io.lastLine).toBe(path.expectedLine);
      expect(afterReload.npcs.io.lastLine).not.toBe(path.wrongLine);
    });
  }

  test("sealed and opened reload paths produce distinct Io recognition lines", async ({ page }) => {
    const sealed = await playSaveReloadPath(page, PACKET_PATHS[0]);
    const opened = await playSaveReloadPath(page, PACKET_PATHS[1]);

    expect(sealed.npcs.io.lastLine).toBe(SEALED_LINE);
    expect(opened.npcs.io.lastLine).toBe(OPENED_LINE);
    expect(sealed.npcs.io.lastLine).not.toBe(opened.npcs.io.lastLine);
  });
});
