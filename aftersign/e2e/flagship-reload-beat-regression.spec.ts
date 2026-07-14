// Reload-beat regression harness for the AFTERSIGN vertical slice.
//
// What it guards (impl at aftersign/index.html, publishState()):
//   • deliverPacket() persists with beat="packet-delivered" SYNCHRONOUSLY,
//     then schedules a setBeat("io-returning-recognition") after 1180ms.
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
      getSnapshot: () => {
        scene: { beat: string };
        packet: { delivered: boolean; sealed: boolean };
        npcs: {
          io: {
            lastLine?: string | null;
            lastLineMemoryRefs?: string[];
            memory: Array<{
              id?: string;
              object?: string;
              action?: string;
              predicate?: string;
              sessionId?: string;
            }>;
          };
        };
        delivery: { outcome: string };
        save: {
          revision: number;
          dirty: boolean;
          authority: "server" | "local-fallback";
          lastLoadProof: {
            source: "server" | "local-fallback" | null;
            revision: number | null;
            playerId: string | null;
          };
        };
      };
    };
  }
}

const WAIT_MS = 10_000;

// The literal strings lineForBeat() emits in aftersign/index.html. If a
// refactor moves these, update BOTH ends together — the spec's job is to
// pin the runtime, not describe it in the abstract.
const DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";
const SEALED_RECOGNITION_LINE =
  "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.";
const OPENED_RECOGNITION_LINE =
  "I remember you: blue route delivered, seal broken. The kiosk kept the route; I kept the risk beside your name.";

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

async function playSaveReloadPath(
  page: Page,
  path: PacketPath,
  options: { clearLocalStateOnReload?: boolean } = {},
) {
  // Only install the break-mode hook when a mode is actually set — a
  // no-op init script on every default-lane test both wastes a bit of
  // navigation setup and (more importantly) muddies the failure diff
  // if anything else about addInitScript timing changes. The default
  // lane runs with FLAGSHIP_BREAK_MODE unset, so this is a no-op and
  // the runtime path is byte-identical to pre-guard behavior.
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
  await page.evaluate(
    (reloadOptions) => window.__game!.input.forceReload(reloadOptions),
    { clearLocalState: options.clearLocalStateOnReload ?? false },
  );
  await idle(page);

  return page.evaluate(() => window.__game!.getSnapshot());
}

// After reload we're at the durable "packet-delivered" beat. The
// sealed/opened split only appears at "io-returning-recognition"; reach
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

      // Live impl (aftersign/index.html):
      //   • deliverPacket() persists with beat="packet-delivered" synchronously,
      //     then advances to "io-returning-recognition" ~1180ms later. The saved
      //     beat we reload from is "packet-delivered".
      //   • npcs.io.memory is the singular array field. There is no plural
      //     `memories` — asserting on it would always be undefined.
      //   • At the reloaded beat lineForBeat() emits the SAME
      //     "Done. Blue route..." string for both paths — the sealed/opened
      //     split only appears at io-returning-recognition. Path is
      //     distinguished here by delivery.outcome + memory[].object.
      expect(afterReload.delivery.outcome).toBe(path.expectedOutcome);
      expect(afterReload.scene.beat).toBe("packet-delivered");
      expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
      expect(
        afterReload.npcs.io.memory.some((memory) => memory.object === path.expectedOutcome),
      ).toBe(true);
      expect(afterReload.npcs.io.lastLine).toBe(DELIVERED_LINE);

      // Now advance to the recognition beat and confirm the durable
      // outcome routes to the correct remembered line.
      const afterRecognition = await advanceToRecognition(page);
      expect(afterRecognition.scene.beat).toBe("io-returning-recognition");
      expect(afterRecognition.npcs.io.lastLine).toBe(path.expectedRecognitionLine);
      expect(afterRecognition.npcs.io.lastLine).not.toBe(path.wrongRecognitionLine);
    });
  }

  test("sealed and opened reload paths produce distinct Io recognition lines", async ({ page }) => {
    await playSaveReloadPath(page, PACKET_PATHS[0]);
    const sealed = await advanceToRecognition(page);

    await playSaveReloadPath(page, PACKET_PATHS[1]);
    const opened = await advanceToRecognition(page);

    expect(sealed.scene.beat).toBe("io-returning-recognition");
    expect(opened.scene.beat).toBe("io-returning-recognition");
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

    expect(sealed.scene.beat).toBe("io-returning-recognition");
    expect(sealed.npcs.io.lastLine).toBe(SEALED_RECOGNITION_LINE);
    expect(sealed.npcs.io.lastLine).not.toBe(OPENED_RECOGNITION_LINE);
  });

  test("FLAGSHIP_BREAK_MODE=drop-memory fails the persisted memory contract", async ({ page }) => {
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== "drop-memory",
      "red guard: only runs when the runtime is deliberately configured to drop Io memory on reload",
    );

    const afterReload = await playSaveReloadPath(page, PACKET_PATHS[0]);

    expect(afterReload.delivery.outcome).toBe("sealed");
    expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
    expect(afterReload.npcs.io.memory.some((memory) => memory.object === "sealed")).toBe(true);
  });

  test("FLAGSHIP_BREAK_MODE=local-only-save fails after a cold restart with local state cleared", async ({ page }) => {
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== "local-only-save",
      "red guard: only runs when the runtime is deliberately configured to prove local-only durability limits",
    );

    // Contract (docs/flagship/story-state-contract.md L237):
    //   local-only-save — state survives a NORMAL reload but FAILS
    //   after `clearLocalState: true` / a device-wipe cold restart.
    //
    // For a red guard the POLARITY must be: fail-under-break, pass
    // once the contract is honored. A durable server-backed store
    // (or any store outliving localStorage.clear()) SURVIVES the
    // wipe — memory returns, packet.delivered returns, save.revision
    // matches. The local-fallback impl at HEAD does NOT survive:
    // readStored() returns null on cold restart, the module rebuilds
    // `state` from emptySave() defaults, and everything the player
    // did is gone.
    //
    // So the load-bearing assertions here are SURVIVAL claims. They
    // fail today under the local-fallback impl (RED = the contract
    // isn't satisfied) and pass automatically the moment a durable
    // store ships (GREEN with zero assertion changes). This mirrors
    // the shape of save-load-durable-contract.spec.ts, which uses
    // the same red-polarity harness for the same reason.
    //
    // Prior draft asserted the FAILURE state (authority ==
    // "local-fallback", memory empty, beat back at packet-offered,
    // outcome "unknown") — that passed under the break instead of
    // failing under it, which is the inverse of what a red guard
    // must do. Soren #662 review caught it; this is the fix.
    //
    // Method:
    //   1. Play packet-kept-sealed → packet-delivered so a
    //      delivered-blue-packet Io memory fact is authored.
    //   2. forceSave() and wait for state.save.dirty to clear —
    //      the impl-agnostic signal that the persist path ran to
    //      completion (durable spec uses the same wait; localStorage
    //      key presence would tie us to the local-fallback impl).
    //   3. localStorage.clear() to simulate a device wipe.
    //   4. page.goto(sameSlotUrl) — cold restart that rebuilds
    //      `state` from module scope (in-page forceReload() cannot
    //      express this honestly — see save-load-durable spec's
    //      note; readStored() early-return would leave the pre-wipe
    //      in-memory state and every assertion below would pass
    //      trivially).
    //   5. Assert survival of the durable fields.
    //
    // The wait-on-dirty (step 2) is intentionally NOT a wait on the
    // localStorage key. Under a future server-authoritative impl
    // there may be no localStorage bucket at all, only a network
    // flush; save.dirty is the surface both impls share.
    const slot = `local-only-save-${Date.now()}`;
    const url = `./?slot=${slot}`;

    await page.addInitScript((mode) => {
      window.__FLAGSHIP_BREAK_MODE = mode;
    }, "local-only-save");

    await page.goto(url);
    await waitForSurface(page);

    for (const choice of PACKET_PATHS[0].choices) {
      await page.evaluate((choiceId) => window.__game!.input.choose(choiceId), choice);
      await idle(page);
    }

    // Snapshot the pre-wipe state so post-restart survival is
    // asserted against the actual values the player produced, not
    // hard-coded literals. Delivering the sealed packet authors the
    // delivered-blue-packet memory fact (index.html memoryFact())
    // and bumps save.revision; both are what a durable store must
    // preserve across a device wipe.
    const beforeWipe = await page.evaluate(() => window.__game!.getSnapshot());
    const sealedFact = beforeWipe.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      sealedFact,
      "precondition: deliver-packet must author the Io sealed-delivery memory before we wipe",
    ).toBeDefined();
    expect(sealedFact!.object).toBe("sealed");
    expect(beforeWipe.packet.delivered).toBe(true);
    expect(beforeWipe.packet.sealed).toBe(true);
    const revisionBeforeWipe = beforeWipe.save.revision;

    await page.evaluate(() => window.__game!.input.forceSave());
    // Wait on save.dirty (not the localStorage key) — this is the
    // impl-agnostic "persist path flushed" signal that continues to
    // work once a server-backed store lands and the local key
    // disappears from the picture entirely.
    await page.waitForFunction(
      () => window.__game?.getSnapshot().save.dirty === false,
      undefined,
      { timeout: WAIT_MS },
    );

    // Wipe local storage, then cold restart. Same slot URL so any
    // future server-authoritative store still gets its chance to
    // rehydrate — only the localStorage bucket is wiped.
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(url);
    await waitForSurface(page);
    await idle(page);

    const afterColdRestart = await page.evaluate(() => window.__game!.getSnapshot());

    // Survival claims — a durable store passes these; the
    // local-fallback impl at HEAD fails them (memory=[],
    // packet.delivered=false, revision=0, beat="packet-offered")
    // because there is nothing outside localStorage to rehydrate
    // from. That failure IS the red guard — it fires precisely when
    // the vertical slice is running local-only, and goes green the
    // moment a durable store lands.
    expect(
      afterColdRestart.packet.delivered,
      "packet.delivered must survive local-state wipe — durable store required",
    ).toBe(true);
    expect(afterColdRestart.packet.sealed).toBe(true);
    expect(afterColdRestart.delivery.outcome).toBe("sealed");
    expect(afterColdRestart.scene.beat).toBe("packet-delivered");

    const recalledFact = afterColdRestart.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      recalledFact,
      "Io sealed-delivery memory must survive local-state wipe — durable store required",
    ).toBeDefined();
    expect(recalledFact!.object).toBe("sealed");
    expect(recalledFact).toEqual(sealedFact);

    expect(
      afterColdRestart.save.revision,
      "save.revision must survive local-state wipe — durable store required",
    ).toBe(revisionBeforeWipe);
  });
});
