import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
  assertDurableSaveLoaded,
  assertNpcReferencesPriorMemory,
  assertSerializableFlagshipSurface,
  assertStoryBeatTransition,
  type FlagshipBreakMode,
  type FlagshipGameSurface,
} from "../../e2e-shared/flagshipStoryStateContract";

// Cold-start budget: SwiftShader init + first WebGL context.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
  }
}

// The single flagship harness spec that consumes the shared contract in
// e2e-shared/flagshipStoryStateContract.ts. Nothing else imports the
// shared contract yet, so this spec keeps every export in the contract
// tied to a load-bearing consumer.
//
// Phase status:
//   - Phase 2 (#565): ACTIVE test below verifies delivery.id/outcome +
//     input helpers (`waitForStoryIdle`, `forceSave`, `forceReload`) +
//     callable choice ids (`keep-sealed`, `deliver-packet`, `return-to-io`).
//   - Phase 3/4: NPC memory and durable save/load are active harness gates;
//     default mode must stay green, and FLAGSHIP_BREAK_MODE proves the same
//     assertions fail under intentional red-polarity regressions.
//   - M2-E1 (#735): ACTIVE test below proves a second route-attention memory
//     chains onto Io's packet memory only after both memories survive a reload.
//
// GREEN-LANE SAFETY (review on #648): every assertion in the ACTIVE
// tests below targets the impl surface that exists at HEAD in
// aftersign/index.html. Signatures match the contract doc
// (docs/flagship/story-state-contract.md lines 87-89): forceSave() takes
// no arguments; forceReload takes { clearLocalState?: boolean } only.
// Per-test isolation uses a unique ?slot= query param (the impl keys
// localStorage by slot), never an invented forceSave/forceReload arg.

const BREAK_MODES: readonly FlagshipBreakMode[] = [
  "drop-memory",
  "wrong-io-line",
  "local-only-save",
] as const;

type IoPacketOutcome = "sealed" | "opened";
// SecondAction matches aftersign/src/state-contract.ts:
//   "done"    — player called `acknowledge-kiosk` before delivery.
//   "skipped" — player called `skip-kiosk-acknowledge`, OR never chose
//               (deliverPacket() normalizes null → "skipped" at fact-mint).
type IoSecondAction = "done" | "skipped";

// The RUNTIME memory-beat shape published on `story.memoryBeat` at the
// io-return-recognition beat. Source of truth is
// aftersign/src/state-contract.ts (interface MemoryBeat) and
// aftersign/index.html publishState (state.story.memoryBeat = { … }).
// The keys here are the ONLY keys the impl publishes — the earlier draft
// of this test asserted `rememberedAction` and hyphenated route lineIds
// that the runtime never publishes, so it could not have gone green.
type StoryMemoryBeat = {
  kind?: string;
  outcome?: IoPacketOutcome;
  lineId?: string;
  secondAction?: IoSecondAction;
  memory_ref?: string | null;
  secondAction_memory_ref?: string | null;
};

type M2Surface = FlagshipGameSurface & {
  story?: {
    memoryBeat?: StoryMemoryBeat | null;
  };
};

// The two recognition line ids the runtime is ALLOWED to publish. Mirrors
// `IoRecognitionLineId` in aftersign/src/state-contract.ts. There is no
// "route-attention" line-id variant at HEAD; the route-attention fact is
// durable memory (surfaces as `secondAction_memory_ref`) but is NOT the
// line Io speaks.
const IO_RECOGNITION_LINE_ID: Record<IoPacketOutcome, string> = {
  sealed: "io_return_packet_sealed",
  opened: "io_return_packet_opened",
};

function currentBreakMode(): FlagshipBreakMode | null {
  const raw = process.env.FLAGSHIP_BREAK_MODE;
  if (!raw) return null;
  if ((BREAK_MODES as readonly string[]).includes(raw)) {
    return raw as FlagshipBreakMode;
  }
  throw new Error(
    `Unknown FLAGSHIP_BREAK_MODE='${raw}'. Expected one of: ${BREAK_MODES.join(", ")}.`,
  );
}

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await waitForVersion(page);
  return page.evaluate(() => window.__game as FlagshipGameSurface);
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

async function chooseAndWait(page: Page, choiceId: string): Promise<void> {
  await page.evaluate((id) => window.__game!.input.choose(id), choiceId);
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

// Play the packet-choice beat. `secondAction` records the second deliberate
// kiosk action BEFORE `deliver-packet` mints the route-attention MemoryFact
// (docs/flagship/story-state-contract.md lines 22-28). Passing `null` skips
// the acknowledge step entirely — the runtime normalizes that to "skipped"
// at fact-mint time, which is the absence-of-action branch.
async function completePacketBeat(
  page: Page,
  outcome: IoPacketOutcome,
  secondAction: IoSecondAction | null,
): Promise<void> {
  await chooseAndWait(page, outcome === "sealed" ? "keep-sealed" : "open-packet");
  if (secondAction === "done") {
    await chooseAndWait(page, "acknowledge-kiosk");
  } else if (secondAction === "skipped") {
    await chooseAndWait(page, "skip-kiosk-acknowledge");
  }
  await chooseAndWait(page, "deliver-packet");
}

async function persistAndClearReload(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
    timeout: WAIT_MS,
  });
  await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
  await readSurface(page);
}

// The memory beat publishes ~1180ms after the recognition beat is reached,
// on a setTimeout (see aftersign/e2e/io-recognition-memory-beat-contract.spec.ts).
// Await a non-null beat for the expected outcome before asserting on it.
async function waitForMemoryBeat(
  page: Page,
  expectedOutcome: IoPacketOutcome,
): Promise<StoryMemoryBeat> {
  const handle = await page.waitForFunction(
    (outcome) => {
      const game = window.__game as (M2Surface & FlagshipGameSurface) | undefined;
      const beat = game?.story?.memoryBeat ?? null;
      return beat && beat.outcome === outcome ? beat : null;
    },
    expectedOutcome,
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as StoryMemoryBeat;
}

function assertChainedMemoryBeat(
  memoryBeat: StoryMemoryBeat,
  outcome: IoPacketOutcome,
  secondAction: IoSecondAction,
): void {
  // The published beat MUST carry the durable delivery-outcome line for the
  // packet outcome AND the recorded second-action, both under one player id.
  expect(memoryBeat.outcome).toBe(outcome);
  expect(memoryBeat.lineId).toBe(IO_RECOGNITION_LINE_ID[outcome]);
  expect(memoryBeat.secondAction).toBe(secondAction);
  // Both memory refs are minted at deliver-packet and survive reload, so at
  // recognition they must be non-null strings — this is the "chained" proof:
  // packet outcome + second action live under one MemoryBeat.
  expect(typeof memoryBeat.memory_ref).toBe("string");
  expect(memoryBeat.memory_ref).toBeTruthy();
  expect(typeof memoryBeat.secondAction_memory_ref).toBe("string");
  expect(memoryBeat.secondAction_memory_ref).toBeTruthy();
  // The two refs must be distinct facts — chaining, not aliasing.
  expect(memoryBeat.memory_ref).not.toBe(memoryBeat.secondAction_memory_ref);
}

function assertSkippedSecondActionMemoryBeat(
  memoryBeat: StoryMemoryBeat,
  outcome: IoPacketOutcome,
): void {
  // Player never called acknowledge-kiosk / skip-kiosk-acknowledge —
  // deliverPacket normalizes null → "skipped" at fact-mint. The two-memory
  // SHAPE is invariant; only the route-attention `object` differs (see
  // state-contract.ts secondAction docs). So both refs are still present.
  expect(memoryBeat.outcome).toBe(outcome);
  expect(memoryBeat.lineId).toBe(IO_RECOGNITION_LINE_ID[outcome]);
  expect(memoryBeat.secondAction).toBe("skipped");
  expect(typeof memoryBeat.memory_ref).toBe("string");
  expect(memoryBeat.memory_ref).toBeTruthy();
  expect(typeof memoryBeat.secondAction_memory_ref).toBe("string");
  expect(memoryBeat.secondAction_memory_ref).toBeTruthy();
}

test.describe("AFTERSIGN flagship surface contract (shared)", () => {
  test.describe.configure({ mode: "serial" });

  test("phase-2 surface: delivery outcome + input helpers", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "phase-2-surface");

    await page.goto(`/aftersign/?slot=flagship-phase2-${Date.now()}`, { waitUntil: "load" });
    await waitForVersion(page);

    const initial = await page.evaluate(() => ({
      delivery: window.__game?.delivery,
      hasChoose: typeof window.__game?.input?.choose === "function",
      hasWaitForStoryIdle: typeof window.__game?.input?.waitForStoryIdle === "function",
      hasForceSave: typeof window.__game?.input?.forceSave === "function",
      hasForceReload: typeof window.__game?.input?.forceReload === "function",
    }));

    expect(initial.delivery?.id).toBe("blue-packet");
    expect(initial.delivery?.outcome).toBe("unknown");
    expect(initial.hasChoose).toBe(true);
    expect(initial.hasWaitForStoryIdle).toBe(true);
    expect(initial.hasForceSave).toBe(true);
    expect(initial.hasForceReload).toBe(true);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const afterDeliver = await page.evaluate(() => ({
      outcome: window.__game?.delivery?.outcome,
    }));
    expect(afterDeliver.outcome).toBe("sealed");

    // forceSave() takes no args; forceReload honors { clearLocalState }
    // per the contract doc. WITHOUT clearLocalState the reload restores
    // the persisted beat ("packet-delivered") — the recognition beat is
    // reachable from there because packet.delivered + memory both
    // survived. This drives the impl's real advance() guard.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const afterReturn = await page.evaluate(() => ({
      beat: window.__game?.scene?.beat,
    }));
    expect(afterReturn.beat).toBe("io-return-recognition");
  });

  test("npc-memory round-trip: Io recognizes the sealed prior session", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "npc-memory-roundtrip");
    const breakMode = currentBreakMode();

    const slot = `flagship-memory-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;

    // Session A: sealed delivery + forceSave.
    await page.goto(url, { waitUntil: "load" });
    await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    // Session B: clearLocalState reload + return-to-io.
    await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
    await readSurface(page);
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const returning = await readSurface(page);
    assertSerializableFlagshipSurface(returning);

    if (breakMode === "drop-memory") {
      let didThrow = false;
      try {
        assertNpcReferencesPriorMemory(returning, "sealed");
      } catch {
        didThrow = true;
      }
      expect(
        didThrow,
        "FLAGSHIP_BREAK_MODE=drop-memory must cause assertNpcReferencesPriorMemory to fail; it did not — the break mode is not wired up.",
      ).toBe(true);
      return;
    }

    if (breakMode === "wrong-io-line") {
      let didThrow = false;
      try {
        assertNpcReferencesPriorMemory(returning, "sealed");
      } catch {
        didThrow = true;
      }
      expect(
        didThrow,
        "FLAGSHIP_BREAK_MODE=wrong-io-line must cause assertNpcReferencesPriorMemory to fail; it did not.",
      ).toBe(true);
      return;
    }

    assertNpcReferencesPriorMemory(returning, "sealed");
    expect(returning.npcs.io.lastLine).toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.sealed);
    expect(returning.save.lastLoadProof.source).toBe("server");
  });

  test("M2-E1: Io chains packet outcome + second-action memory across a durable reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "m2-e1-chained-memory");
    const breakMode = currentBreakMode();

    for (const outcome of ["sealed", "opened"] as const) {
      // Session A — record BOTH the packet outcome and an explicit
      // second-action ("done" via acknowledge-kiosk), then durable-save +
      // hard reload (clearLocalState). If the chain is real, session B
      // rehydrates both facts under one player id off the authoritative
      // save alone.
      const chainedSlot = `flagship-m2-${outcome}-chained-${Date.now()}`;
      const chainedUrl = `/aftersign/?slot=${chainedSlot}`;

      await page.goto(chainedUrl, { waitUntil: "load" });
      await readSurface(page);
      await completePacketBeat(page, outcome, "done");
      await persistAndClearReload(page);
      await chooseAndWait(page, "return-to-io");

      const chainedReturn = await readSurface(page);
      assertSerializableFlagshipSurface(chainedReturn);

      // Both durable memory facts must be back on Io after the hard reload.
      const chainedFactKinds = chainedReturn.npcs.io.memory.map((fact) => fact.kind);
      expect(chainedFactKinds).toContain("delivery-outcome");
      expect(chainedFactKinds).toContain("route-attention");

      const chainedBeat = await waitForMemoryBeat(page, outcome);

      if (breakMode === "drop-memory" || breakMode === "wrong-io-line") {
        let didThrow = false;
        try {
          assertChainedMemoryBeat(chainedBeat, outcome, "done");
        } catch {
          didThrow = true;
        }
        expect(
          didThrow,
          `FLAGSHIP_BREAK_MODE=${breakMode} must make the chained memory-beat assertion fail for ${outcome}; it did not.`,
        ).toBe(true);
        continue;
      }

      assertChainedMemoryBeat(chainedBeat, outcome, "done");

      // Contrast branch — same packet outcome, but the player never called
      // acknowledge-kiosk/skip-kiosk-acknowledge. deliverPacket normalizes
      // null → "skipped" at fact-mint; the two-memory shape is invariant,
      // only the recorded secondAction differs. This proves the recorded
      // second action actually reaches the published beat (not a hardcoded
      // literal).
      const skippedSlot = `flagship-m2-${outcome}-skipped-${Date.now()}`;
      const skippedUrl = `/aftersign/?slot=${skippedSlot}`;

      await page.goto(skippedUrl, { waitUntil: "load" });
      await readSurface(page);
      await completePacketBeat(page, outcome, null);
      await persistAndClearReload(page);
      await chooseAndWait(page, "return-to-io");

      const skippedReturn = await readSurface(page);
      assertSerializableFlagshipSurface(skippedReturn);

      const skippedBeat = await waitForMemoryBeat(page, outcome);
      assertSkippedSecondActionMemoryBeat(skippedBeat, outcome);
      // The two runs share an outcome but MUST differ on secondAction —
      // otherwise the recorded input isn't reaching the beat.
      expect(skippedBeat.secondAction).not.toBe(chainedBeat.secondAction);
    }
  });

  test("durable save/load: authoritative reload survives clearLocalState", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-save-load");
    const breakMode = currentBreakMode();

    const slot = `flagship-durable-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;

    await page.goto(url, { waitUntil: "load" });
    await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const beforeReload = await readSurface(page);
    assertSerializableFlagshipSurface(beforeReload);

    expect(beforeReload.save.authority).toBe("server");
    expect(beforeReload.delivery.outcome).toBe("sealed");
    expect(beforeReload.save.dirty).toBe(false);

    await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
    const afterReload = await readSurface(page);

    if (breakMode === "local-only-save") {
      let didThrow = false;
      try {
        assertDurableSaveLoaded(beforeReload, afterReload);
      } catch {
        didThrow = true;
      }
      expect(
        didThrow,
        "FLAGSHIP_BREAK_MODE=local-only-save must cause assertDurableSaveLoaded to fail; it did not.",
      ).toBe(true);
      return;
    }

    assertDurableSaveLoaded(beforeReload, afterReload);
  });

  test("story-state invariant: sealed delivery advances the authored beats", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "story-state-invariant");
    const breakMode = currentBreakMode();

    await page.goto(`/aftersign/?slot=flagship-story-${Date.now()}`, { waitUntil: "load" });

    const initial = await readSurface(page);
    assertSerializableFlagshipSurface(initial);

    expect(initial.scene.beat === "arrival" || initial.scene.beat === "packet-offered").toBe(true);
    expect(initial.delivery.outcome).toBe("unknown");

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterChoice = await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterDeliver = await readSurface(page);

    assertStoryBeatTransition(afterChoice, afterDeliver, "packet-delivered", "io_intro_seen");
    expect(afterDeliver.delivery.outcome).toBe("sealed");
    expect(afterDeliver.npcs.io.trustPosture).toBe("trusted-seal");

    if (breakMode === "wrong-io-line") {
      // This branch intentionally only documents mode ownership.
    }
  });
});
