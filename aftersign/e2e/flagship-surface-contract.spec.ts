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
type IoRouteAttention = "listened" | "skipped";

type StoryMemoryBeat = {
  lineId?: string;
  rememberedAction?: string | readonly string[];
};

type M2Surface = FlagshipGameSurface & {
  story?: {
    memoryBeat?: StoryMemoryBeat;
  };
};

const IO_CHAINED_MEMORY_ID: Record<IoPacketOutcome, Record<IoRouteAttention, string>> = {
  sealed: {
    listened: "io-return-sealed-listened-route",
    skipped: "io-return-sealed-skipped-route",
  },
  opened: {
    listened: "io-return-opened-listened-route",
    skipped: "io-return-opened-skipped-route",
  },
};

const IO_SINGLE_MEMORY_ID: Record<IoPacketOutcome, string> = {
  sealed: "io-return-sealed-packet",
  opened: "io-return-opened-packet",
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

async function completePacketBeat(page: Page, outcome: IoPacketOutcome): Promise<void> {
  await chooseAndWait(page, outcome === "sealed" ? "keep-sealed" : "open-packet");
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

async function completeRouteAttentionBeat(
  page: Page,
  routeAttention: IoRouteAttention,
): Promise<void> {
  await chooseAndWait(page, routeAttention === "listened" ? "listen-to-route" : "skip-route");
}

function readMemoryBeat(surface: FlagshipGameSurface): StoryMemoryBeat {
  const memoryBeat = (surface as M2Surface).story?.memoryBeat;
  expect(memoryBeat, "window.__game.story.memoryBeat must expose the active Io memory line.").toBeTruthy();
  return memoryBeat!;
}

function rememberedActions(memoryBeat: StoryMemoryBeat): readonly string[] {
  if (!memoryBeat.rememberedAction) return [];
  return Array.isArray(memoryBeat.rememberedAction)
    ? memoryBeat.rememberedAction
    : [memoryBeat.rememberedAction];
}

function assertTwoMemoryIoLine(
  surface: FlagshipGameSurface,
  outcome: IoPacketOutcome,
  routeAttention: IoRouteAttention,
): void {
  const memoryBeat = readMemoryBeat(surface);
  expect(memoryBeat.lineId).toBe(IO_CHAINED_MEMORY_ID[outcome][routeAttention]);
  expect(memoryBeat.lineId).not.toBe(IO_SINGLE_MEMORY_ID[outcome]);
  expect(rememberedActions(memoryBeat)).toContain(IO_SINGLE_MEMORY_ID[outcome]);
  expect(rememberedActions(memoryBeat)).toContain(
    routeAttention === "listened" ? "io-route-listened" : "io-route-skipped",
  );
}

function assertSingleMemoryIoLine(surface: FlagshipGameSurface, outcome: IoPacketOutcome): void {
  const memoryBeat = readMemoryBeat(surface);
  expect(memoryBeat.lineId).toBe(IO_SINGLE_MEMORY_ID[outcome]);
  expect(memoryBeat.lineId).not.toBe(IO_CHAINED_MEMORY_ID[outcome].listened);
  expect(memoryBeat.lineId).not.toBe(IO_CHAINED_MEMORY_ID[outcome].skipped);
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

  test("M2-E1: Io chains route attention onto packet memory only after both survive reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "m2-e1-chained-memory");
    const breakMode = currentBreakMode();

    for (const outcome of ["sealed", "opened"] as const) {
      const twoMemorySlot = `flagship-m2-${outcome}-two-memory-${Date.now()}`;
      const twoMemoryUrl = `/aftersign/?slot=${twoMemorySlot}`;

      await page.goto(twoMemoryUrl, { waitUntil: "load" });
      await readSurface(page);
      await completePacketBeat(page, outcome);
      await persistAndClearReload(page);
      await completeRouteAttentionBeat(page, "listened");
      await persistAndClearReload(page);
      await chooseAndWait(page, "return-to-io");

      const twoMemoryReturn = await readSurface(page);
      assertSerializableFlagshipSurface(twoMemoryReturn);

      if (breakMode === "drop-memory" || breakMode === "wrong-io-line") {
        let didThrow = false;
        try {
          assertTwoMemoryIoLine(twoMemoryReturn, outcome, "listened");
        } catch {
          didThrow = true;
        }
        expect(
          didThrow,
          `FLAGSHIP_BREAK_MODE=${breakMode} must make the two-memory Io branch fail for ${outcome}; it did not.`,
        ).toBe(true);
        continue;
      }

      assertTwoMemoryIoLine(twoMemoryReturn, outcome, "listened");

      const packetOnlySlot = `flagship-m2-${outcome}-packet-only-${Date.now()}`;
      const packetOnlyUrl = `/aftersign/?slot=${packetOnlySlot}`;

      await page.goto(packetOnlyUrl, { waitUntil: "load" });
      await readSurface(page);
      await completePacketBeat(page, outcome);
      await persistAndClearReload(page);
      await persistAndClearReload(page);
      await chooseAndWait(page, "return-to-io");

      const packetOnlyReturn = await readSurface(page);
      assertSerializableFlagshipSurface(packetOnlyReturn);
      assertSingleMemoryIoLine(packetOnlyReturn, outcome);
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
