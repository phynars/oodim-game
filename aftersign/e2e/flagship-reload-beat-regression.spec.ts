import { expect, test, type Page } from "@playwright/test";
import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

type IoMemory = { id?: string; object?: string; action?: string };
type ReloadSnapshot = {
  scene: { beat: string };
  npcs: { io: { lastLine?: string | null; lastLineMemoryRefs?: string[]; memory: IoMemory[] } };
  delivery: { outcome: string };
};

declare global {
  interface Window {
    __FLAGSHIP_BREAK_MODE?: string;
    __game?: {
      input: {
        choose: (choiceId: string) => void | Promise<void>;
        forceSave: () => void | Promise<void>;
        forceReload: (options?: { clearLocalState?: boolean }) => void | Promise<void>;
        waitForStoryIdle: () => void | Promise<void>;
      };
      getSnapshot: () => ReloadSnapshot;
    };
  }
}

const WAIT_MS = 10_000;
const FRESH_DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";

type PacketPath = {
  name: string;
  choices: string[];
  expectedOutcome: "sealed" | "opened";
  expectedRecognitionLine: string;
  wrongRecognitionLine: string;
  expectedReloadedDeliveredLine: string;
};

const PACKET_PATHS: PacketPath[] = [
  {
    name: "sealed packet",
    choices: ["keep-sealed", "deliver-packet"],
    expectedOutcome: "sealed",
    expectedRecognitionLine: expectedIoRecognitionLine("sealed", false),
    wrongRecognitionLine: expectedIoRecognitionLine("opened", false),
    expectedReloadedDeliveredLine: ioReturningSessionLines.sealedPacketSkippedRoute,
  },
  {
    name: "opened packet",
    choices: ["open-packet", "deliver-packet"],
    expectedOutcome: "opened",
    expectedRecognitionLine: expectedIoRecognitionLine("opened", false),
    wrongRecognitionLine: expectedIoRecognitionLine("sealed", false),
    expectedReloadedDeliveredLine: ioReturningSessionLines.openedPacketSkippedRoute,
  },
];

async function waitForSurface(page: Page): Promise<void> {
  // `?.input.choose` (not `?.input?.choose`): waitForFunction re-polls on
  // throw, so a transient `input === undefined` retries rather than crashes.
  // The optional chain on `__game` is what guards the boot race; nested
  // optional chains would just hide a real contract break in `input`.
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function" &&
      typeof window.__game?.input.choose === "function" &&
      typeof window.__game?.input.forceSave === "function" &&
      typeof window.__game?.input.forceReload === "function" &&
      typeof window.__game?.input.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
}

async function idle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

function uniqueSlotKey(path: PacketPath): string {
  return `flagship-reload-${path.expectedOutcome}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function playSaveReloadPath(page: Page, path: PacketPath): Promise<ReloadSnapshot> {
  const breakMode = process.env.FLAGSHIP_BREAK_MODE;
  if (breakMode) {
    await page.addInitScript((mode) => {
      window.__FLAGSHIP_BREAK_MODE = mode;
    }, breakMode);
  }

  await page.goto(`./?slot=${uniqueSlotKey(path)}`);
  await waitForSurface(page);

  const baseline = await page.evaluate(() => window.__game!.getSnapshot());
  expect(baseline.delivery.outcome).toBe("unknown");
  expect(baseline.npcs.io.memory).toHaveLength(0);

  for (const choice of path.choices) {
    await page.evaluate((choiceId) => window.__game!.input.choose(choiceId), choice);
    await idle(page);
  }

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.evaluate(() => window.__game!.input.forceReload());
  await idle(page);
  return page.evaluate(() => window.__game!.getSnapshot());
}

function expectReloadedOutcome(afterReload: ReloadSnapshot, path: PacketPath): void {
  expect(afterReload.delivery.outcome).toBe(path.expectedOutcome);
  expect(["packet-delivered", "io-return-recognition"]).toContain(afterReload.scene.beat);
  expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
  expect(afterReload.npcs.io.memory.some((memory) => memory.object === path.expectedOutcome)).toBe(true);

  if (afterReload.scene.beat === "packet-delivered") {
    expect(afterReload.npcs.io.lastLine).toBe(path.expectedReloadedDeliveredLine);
    expect(afterReload.npcs.io.lastLine).not.toBe(FRESH_DELIVERED_LINE);
  } else {
    expect(afterReload.npcs.io.lastLine).toBe(path.expectedRecognitionLine);
    expect(afterReload.npcs.io.lastLine).not.toBe(path.wrongRecognitionLine);
  }
}

async function advanceToRecognition(page: Page): Promise<ReloadSnapshot> {
  const beat = await page.evaluate(() => window.__game!.getSnapshot().scene.beat);
  if (beat !== "io-return-recognition") {
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await idle(page);
  }
  return page.evaluate(() => window.__game!.getSnapshot());
}

test.describe("AFTERSIGN reload beat regression", () => {
  test.describe.configure({ timeout: WAIT_MS });

  for (const path of PACKET_PATHS) {
    test(`reloads the ${path.name} outcome and remembers it durably`, async ({ page }) => {
      const afterReload = await playSaveReloadPath(page, path);
      expectReloadedOutcome(afterReload, path);

      const afterRecognition = await advanceToRecognition(page);
      expect(afterRecognition.scene.beat).toBe("io-return-recognition");
      expect(afterRecognition.npcs.io.lastLine).toBe(path.expectedRecognitionLine);
      expect(afterRecognition.npcs.io.lastLine).not.toBe(path.wrongRecognitionLine);
    });
  }

  test("sealed and opened reload paths produce distinct Io recognition lines", async ({ page }) => {
    await playSaveReloadPath(page, PACKET_PATHS[0]);
    const sealed = await advanceToRecognition(page);
    await playSaveReloadPath(page, PACKET_PATHS[1]);
    const opened = await advanceToRecognition(page);

    expect(sealed.scene.beat).toBe("io-return-recognition");
    expect(opened.scene.beat).toBe("io-return-recognition");
    expect(sealed.npcs.io.lastLine).toBe(PACKET_PATHS[0].expectedRecognitionLine);
    expect(opened.npcs.io.lastLine).toBe(PACKET_PATHS[1].expectedRecognitionLine);
    expect(sealed.npcs.io.lastLine).not.toBe(opened.npcs.io.lastLine);
  });

  test("FLAGSHIP_BREAK_MODE=wrong-io-line fails the outcome-correct Io line contract", async ({ page }) => {
    test.skip(process.env.FLAGSHIP_BREAK_MODE !== "wrong-io-line", "red guard");
    test.setTimeout(COLD_START_MS);
    await playSaveReloadPath(page, PACKET_PATHS[0]);
    const sealed = await advanceToRecognition(page);
    expect(sealed.scene.beat).toBe("io-return-recognition");
    expect(sealed.npcs.io.lastLine).toBe(PACKET_PATHS[0].expectedRecognitionLine);
    expect(sealed.npcs.io.lastLine).not.toBe(PACKET_PATHS[0].wrongRecognitionLine);
  });

  test("FLAGSHIP_BREAK_MODE=drop-memory fails the persisted memory contract", async ({ page }) => {
    test.skip(process.env.FLAGSHIP_BREAK_MODE !== "drop-memory", "red guard");
    const afterReload = await playSaveReloadPath(page, PACKET_PATHS[0]);
    expectReloadedOutcome(afterReload, PACKET_PATHS[0]);
  });
});
