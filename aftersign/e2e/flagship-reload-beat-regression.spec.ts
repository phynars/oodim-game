import { expect, test, type Page } from "@playwright/test";
import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

type IoMemory = { id?: string; object?: string; action?: string };
type ReloadSnapshot = {
  scene: { beat: string };
  npcs: { io: { lastLine?: string | null; lastLineMemoryRefs?: string[]; memories: IoMemory[] } };
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
    /**
     * Set by `advanceToRecognition`'s in-browser observer: the FIRST
     * `getSnapshot()` reading where `(beat, lastLine)` both matched
     * the expected recognition pair. Sampled on RAF frames so the
     * transient `io-return-recognition` window is not lost to a
     * downstream auto-advance into `return-tone-choice` (issue #1966).
     */
    __flagshipRecognitionSnapshot?: ReloadSnapshot;
  }
}

const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;
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

  await expect
    .poll(
      () => page.evaluate(() => Array.isArray(window.__game!.getSnapshot().npcs.io.memories)),
      { timeout: WAIT_MS },
    )
    .toBe(true);
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
  expect(baseline.npcs.io.memories).toHaveLength(0);

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
  expect(afterReload.npcs.io.memories.length).toBeGreaterThan(0);
  expect(afterReload.npcs.io.memories.some((memory) => memory.object === path.expectedOutcome)).toBe(true);

  if (afterReload.scene.beat === "packet-delivered") {
    expect(afterReload.npcs.io.lastLine).toBe(path.expectedReloadedDeliveredLine);
    expect(afterReload.npcs.io.lastLine).not.toBe(FRESH_DELIVERED_LINE);
  } else {
    expect(afterReload.npcs.io.lastLine).toBe(path.expectedRecognitionLine);
    expect(afterReload.npcs.io.lastLine).not.toBe(path.wrongRecognitionLine);
  }
}

async function advanceToRecognition(page: Page, path: PacketPath): Promise<ReloadSnapshot> {
  // Install the RAF observer FIRST — before the "Return to Io" click.
  // The previous shape clicked, then gated on an `expect.poll(beat)
  // === "io-return-recognition"` (~100 ms sampling) BEFORE the
  // observer existed. On cold CI the story auto-advanced into
  // `return-tone-choice` between poll ticks, so that poll itself
  // failed with `Received: "return-tone-choice"` (post-#1967 CI on
  // the opened-packet path, issue #1966). Capturing from the
  // observer alone closes that window.
  await installRecognitionObserver(page, path.expectedRecognitionLine);

  const beat = await page.evaluate(() => window.__game!.getSnapshot().scene.beat);
  if (beat === "packet-delivered") {
    const advanceControl = page.locator("#deliverButton");
    await expect(advanceControl).toBeVisible({ timeout: WAIT_MS });
    await expect(advanceControl).toBeEnabled({ timeout: WAIT_MS });
    await expect(advanceControl).toHaveText("Return to Io", { timeout: WAIT_MS });
    await advanceControl.click();
    // see #1949, #1931 — the beat gate is now the observer below,
    // not a coarse poll that can miss the transient recognition beat.
  }

  const recognitionLine = page.locator("#line");
  await expect(recognitionLine).toBeVisible({ timeout: WAIT_MS });

  // Wait for the observer to freeze the recognition snapshot. This is
  // still capped at WAIT_MS — a genuine failure (recognition line
  // never rendered) surfaces as a timeout here, not as a false
  // downstream `return-tone-choice` reading.
  await page.waitForFunction(
    () => window.__flagshipRecognitionSnapshot !== undefined,
    undefined,
    { timeout: WAIT_MS },
  );

  const recognitionSnapshot = await page.evaluate(() => {
    const captured = window.__flagshipRecognitionSnapshot;
    delete window.__flagshipRecognitionSnapshot;
    return captured;
  });
  if (!recognitionSnapshot) {
    throw new Error("Recognition snapshot was not captured during the progressive gate");
  }
  return recognitionSnapshot;
}

async function installRecognitionObserver(page: Page, expectedRecognitionLine: string): Promise<void> {
  // Install a RAF-tight in-browser observer BEFORE the recognition
  // window opens. Playwright's `expect.poll` samples on a ~100 ms
  // interval, so if the story auto-advances from
  // `io-return-recognition` into `return-tone-choice` in less than
  // one poll tick the recognition state is missed entirely and the
  // final polled reading is the post-advance beat (issue #1966 —
  // observed as `Received: "return-tone-choice"` on cold CI).
  //
  // The observer polls `getSnapshot()` on every animation frame
  // (~16 ms), and freezes the FIRST snapshot whose
  // `(beat, lastLine)` pair matches the expected recognition state
  // onto `window.__flagshipRecognitionSnapshot`. Once frozen, later
  // auto-advances cannot overwrite it — the test asserts against the
  // captured moment, not a re-fetched snapshot that may have drifted.
  await page.evaluate((expectedRecognitionLine) => {
    delete window.__flagshipRecognitionSnapshot;
    const sample = () => {
      if (window.__flagshipRecognitionSnapshot) return;
      const snapshot = window.__game?.getSnapshot();
      if (!snapshot) return;
      if (
        snapshot.scene.beat === "io-return-recognition" &&
        snapshot.npcs.io.lastLine === expectedRecognitionLine
      ) {
        window.__flagshipRecognitionSnapshot = snapshot;
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, expectedRecognitionLine);
}

test.describe("AFTERSIGN reload beat regression", () => {
  for (const path of PACKET_PATHS) {
    test(`reloads the ${path.name} outcome and remembers it durably`, async ({ page }) => {
      const afterReload = await playSaveReloadPath(page, path);
      expectReloadedOutcome(afterReload, path);

      const afterRecognition = await advanceToRecognition(page, path);
      expect(afterRecognition.scene.beat).toBe("io-return-recognition");
      expect(afterRecognition.npcs.io.lastLine).toBe(path.expectedRecognitionLine);
      expect(afterRecognition.npcs.io.lastLine).not.toBe(path.wrongRecognitionLine);
    });
  }

  test("sealed and opened reload paths produce distinct Io recognition lines", async ({ page }) => {
    await playSaveReloadPath(page, PACKET_PATHS[0]);
    const sealed = await advanceToRecognition(page, PACKET_PATHS[0]);
    await playSaveReloadPath(page, PACKET_PATHS[1]);
    const opened = await advanceToRecognition(page, PACKET_PATHS[1]);

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
    const sealed = await advanceToRecognition(page, PACKET_PATHS[0]);
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
