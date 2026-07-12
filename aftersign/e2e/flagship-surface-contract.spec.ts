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
//   - Remaining tests stay fixme until Phases 3/4 fields are shipped.

const BREAK_MODES: readonly FlagshipBreakMode[] = [
  "drop-memory",
  "wrong-io-line",
  "local-only-save",
] as const;

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

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const afterReturn = await page.evaluate(() => ({
      beat: window.__game?.scene?.beat,
    }));
    expect(afterReturn.beat).toBe("io-returning-recognition");
  });

  // Unfixme in Phase 3 once npcs.io.memories, npcs.io.lastLine,
  // npcs.io.lastLineMemoryRefs, and npcs.io.trustPosture are populated
  // on the return-to-io beat.
  //
  // redgreen-sentinel: npc-memory-drop-memory-guard-pending
  // ^ Structured retirement marker for the red-polarity CI lane (#622).
  //   scripts/aftersign-npc-memory-redgreen-preflight.sh keys retirement
  //   off this exact sentinel line, NOT the test title — renaming this
  //   test is safe. DELETE the sentinel when converting this fixme into
  //   the conditional skip keyed off FLAGSHIP_BREAK_MODE === "drop-memory"
  //   (mirror the durable-save spec's guard pattern); the preflight then
  //   re-arms the red lane automatically.
  test.fixme("npc-memory round-trip: Io recognizes the sealed prior session", async ({ page }) => {
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

  // Unfixme in Phase 4 once save.authority, save.lastLoadProof, and
  // the FLAGSHIP_BREAK_MODE vite wire-up exist.
  test.fixme("durable save/load: authoritative reload survives clearLocalState", async ({ page }) => {
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

  // Unfixme once scene/player blocks from Phase 1 + trust posture from
  // Phase 3 are available together.
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
