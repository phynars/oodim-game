// Reload-beat regression harness for the AFTERSIGN vertical slice.
//
// What it guards (impl at aftersign/index.html, publishState()):
//   • deliverPacket() persists with beat="packet-delivered" SYNCHRONOUSLY,
//     then schedules a setBeat("io-return-recognition") after 1180ms.
//     The persisted beat we reload from is "packet-delivered" — that's
//     the durable one; the returning-line beat is a live-session
//     animation, not a save-state. To reach it after a reload the test
//     calls choose("return-to-io"), which routes through advance() and
//     promotes the beat when packet.delivered && memory.length > 0
//     (both survive reload).
//   • state.npcs.io.memory (SINGULAR) is the field publishState exposes.
//     There is no plural `memories` — asserting on it would read undefined
//     and pass silently even after a regression. The shared contract
//     (e2e-shared/flagshipStoryStateContract.ts) uses `memories`, but that
//     surface is `test.fixme`'d until Phase 3 (#566) lands the rename.
//     Until then this spec asserts against the LIVE shape.
//   • The expected lastLine strings are pinned to lineForBeat() in
//     aftersign/index.html — the ONLY source publishState() reads. The
//     earlier draft pinned to constants in aftersign/src/io-dialogue.ts
//     which index.html doesn't import; that failed on strict equality
//     because the runtime never emits those strings.
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
    __FLAGSHIP_BREAK_MODE?: string;
    __game?: {
      scene: { beat: string };
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

type ReloadSnapshot = {
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

const WAIT_MS = 10_000;

// The literal strings lineForBeat() emits in aftersign/index.html. If a
// refactor moves these, update BOTH ends together — the spec's job is to
// pin the runtime, not describe it in the abstract.
const DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";
const SEALED_RECOGNITION_LINE =
  "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.";
const OPENED_RECOGNITION_LINE =
  "I remember you: blue route delivered. The seal did not survive. The kiosk kept the route; I kept the risk beside your name.";

type PacketPath = {
  name: string;
  choices: string[];
  expectedOutcome: "sealed" | "opened";
  expectedRecognitionLine: string;
  wrongRecognitionLine: string;
};

const PACKET_PATHS: PacketPath[] = [
  {
    name: "sealed packet",
    choices: ["keep-sealed", "deliver-packet"],
    expectedOutcome: "sealed",
    expectedRecognitionLine: SEALED_RECOGNITION_LINE,
    wrongRecognitionLine: OPENED_RECOGNITION_LINE,
  },
  {
    name: "opened packet",
    choices: ["open-packet", "deliver-packet"],
    expectedOutcome: "opened",
    expectedRecognitionLine: OPENED_RECOGNITION_LINE,
    wrongRecognitionLine: SEALED_RECOGNITION_LINE,
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
  // Only install the break-mode hook when a mode is actually set — the
  // default lane runs with FLAGSHIP_BREAK_MODE unset, so this is a no-op
  // and the runtime path stays byte-identical to pre-guard behavior.
  const breakMode = process.env.FLAGSHIP_BREAK_MODE;
  if (breakMode) {
    await page.addInitScript((mode) => {
      window.__FLAGSHIP_BREAK_MODE = mode;
    }, breakMode);
  }
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

// Shared post-reload assertion block. Both the green-path tests and the
// drop-memory red probe reload to beat="packet-delivered" and want the
// same five properties held (or, under drop-memory, deliberately broken
// at memory.length>0 so the red workflow inverts). Keeping ONE helper
// keeps the assertions byte-identical across callers — future edits
// touch one place, not two.
function expectReloadedOutcome(afterReload: ReloadSnapshot, path: PacketPath): void {
  // Live impl (aftersign/index.html):
  //   • deliverPacket() persists with beat="packet-delivered" synchronously,
  //     then advances to "io-return-recognition" ~1180ms later. The saved
  //     beat we reload from is "packet-delivered".
  //   • npcs.io.memory is the singular array field. There is no plural
  //     `memories` — asserting on it would always be undefined.
  //   • At the reloaded beat lineForBeat() emits the SAME
  //     "Done. Blue route..." string for both paths — the sealed/opened
  //     split only appears at io-return-recognition. Path is
  //     distinguished here by delivery.outcome + memory[].object.
  expect(afterReload.delivery.outcome).toBe(path.expectedOutcome);
  expect(afterReload.scene.beat).toBe("packet-delivered");
  expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
  expect(afterReload.npcs.io.memory.some((memory) => memory.object === path.expectedOutcome)).toBe(
    true,
  );
  expect(afterReload.npcs.io.lastLine).toBe(DELIVERED_LINE);
}

// After reload we're at the durable "packet-delivered" beat. The
// sealed/opened split only appears at "io-return-recognition"; reach
// it deterministically by routing through advance() — no wall-clock wait,
// no reliance on the 1180ms setTimeout (which doesn't survive reload).
async function advanceToRecognition(page: Page) {
  await page.evaluate(() => window.__game!.input.choose("return-to-io"));
  await idle(page);
  return page.evaluate(() => window.__game!.getSnapshot());
}

test.describe("AFTERSIGN reload beat regression", () => {
  for (const path of PACKET_PATHS) {
    test(`reloads the ${path.name} outcome and remembers it durably`, async ({ page }) => {
      const afterReload = await playSaveReloadPath(page, path);

      expectReloadedOutcome(afterReload, path);

      // Now advance to the recognition beat and confirm the durable
      // outcome routes to the correct remembered line.
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
    expect(sealed.npcs.io.lastLine).toBe(SEALED_RECOGNITION_LINE);
    expect(opened.npcs.io.lastLine).toBe(OPENED_RECOGNITION_LINE);
    expect(sealed.npcs.io.lastLine).not.toBe(opened.npcs.io.lastLine);
  });

  test("FLAGSHIP_BREAK_MODE=wrong-io-line fails the outcome-correct Io line contract", async ({ page }) => {
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== "wrong-io-line",
      "red guard: only runs when the runtime is deliberately configured to swap Io recognition lines",
    );

    await playSaveReloadPath(page, PACKET_PATHS[0]);
    const sealed = await advanceToRecognition(page);

    // Under wrong-io-line the runtime swaps the recognition line, so the
    // sealed path speaks the OPENED line and these assertions FAIL —
    // that failure is the red-polarity proof the workflow inverts.
    expect(sealed.scene.beat).toBe("io-return-recognition");
    expect(sealed.npcs.io.lastLine).toBe(SEALED_RECOGNITION_LINE);
    expect(sealed.npcs.io.lastLine).not.toBe(OPENED_RECOGNITION_LINE);
  });

  test("FLAGSHIP_BREAK_MODE=drop-memory fails the persisted memory contract", async ({ page }) => {
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== "drop-memory",
      "red guard: only runs when the runtime is deliberately configured to drop Io memory on reload",
    );

    const afterReload = await playSaveReloadPath(page, PACKET_PATHS[0]);

    // Under drop-memory reloadFromSave() discards saved.memory, so
    // memory.length is 0 and these assertions FAIL — red polarity.
    expectReloadedOutcome(afterReload, PACKET_PATHS[0]);
  });

  // FLAGSHIP_BREAK_MODE=local-only-save red coverage is NOT re-implemented
  // here — one owner per break mode keeps polarity auditable. Durability's
  // red-polarity workflow (.github/workflows/aftersign-durable-save-redgreen.yml)
  // targets save-load-durable-contract.spec.ts, which is the shared-contract
  // owner for the durable save/load rule. That workflow's preflight already
  // self-retires when the FLAGSHIP_BREAK_MODE guard string is removed from
  // the owner spec, so re-adding a parallel red probe here would either
  //   (a) duplicate the assertion in a lane that never runs it (CI gap:
  //       nothing sets FLAGSHIP_BREAK_MODE=local-only-save against THIS
  //       spec — the aftersign-durable-save-redgreen job targets a
  //       different spec via package.json:44), OR
  //   (b) split ownership across two files and let one drift silently.
  // The break-mode HOOK still lives in aftersign/index.html (forceSave
  // short-circuits under local-only-save; reloadFromSave skips the server
  // read) so the durable-save spec's red polarity CAN be re-enabled just
  // by restoring its FLAGSHIP_BREAK_MODE guard — no impl change required.
  // The wrong-io-line / drop-memory red probes above stay here because
  // this spec IS their owner (they assert against beat+line surface, not
  // durability), and the aftersign-npc-memory-redgreen workflow targets
  // flagship-surface-contract for drop-memory as its shared owner.
});
