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
//
// GREEN-LANE SAFETY (review on #648): every assertion in the ACTIVE
// tests below targets the impl surface that exists at HEAD in
// aftersign/index.html. Assertions that require the not-yet-implemented
// server-authoritative save path (save.authority === "server",
// save.lastLoadProof.source === "server") live ONLY inside test.fixme
// blocks, mirroring the skip discipline of
// save-load-durable-contract.spec.ts. Signatures match the contract doc
// (docs/flagship/story-state-contract.md lines 87-89): forceSave() takes
// no arguments; forceReload takes { clearLocalState?: boolean } only.
// Per-test isolation uses a unique ?slot= query param (the impl keys
// localStorage by slot), never an invented forceSave/forceReload arg.

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

  // Phase 3 (#566): LIVE. memoryFact() now emits the contract shape
  // ({ id: 'io-remembers-blue-packet-sealed', kind: 'delivery-outcome',
  // source: 'server', ... }) and lastLine carries the authored fragment,
  // so assertNpcReferencesPriorMemory passes at HEAD. The one remaining
  // Phase-4 dependency — save.lastLoadProof.source === 'server' — has
  // moved OUT of this test and into the Phase-4 durable-save test below,
  // so this test no longer gates on the server-authoritative save path.
  //
  // The former @redgreen fixme sentinel is gone: the conditional
  // test.skip guard below (same pattern as
  // save-load-durable-contract.spec.ts) is what the preflight step in
  // .github/workflows/aftersign-npc-memory-redgreen.yml greps to decide
  // that the red-polarity lane may run. The guard check takes precedence
  // over the retired-marker check, so this conversion un-retires the
  // red lane in the same diff.
  test("npc-memory round-trip: Io recognizes the sealed prior session", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "npc-memory-roundtrip");
    const breakMode = currentBreakMode();
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== "drop-memory"
        && process.env.FLAGSHIP_BREAK_MODE !== "wrong-io-line"
        && breakMode !== null,
      "npc-memory round-trip only runs in default mode or under a memory-owned break mode.",
    );

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

  // Unfixme in Phase 4 once the server-authoritative save path lands:
  // save.authority must become "server" after a durable save (today
  // emptySave() hardcodes "local-fallback" and forceSave/reloadFromSave
  // never upgrade it), and reloadFromSave must stamp
  // save.lastLoadProof = { source: "server", revision, playerId }
  // (today it stays { source: null, ... }). Until both exist,
  // assertDurableSaveLoaded cannot pass against HEAD — keeping this
  // fixme'd protects the default e2e lane, exactly like the
  // FLAGSHIP_BREAK_MODE skip guard in save-load-durable-contract.spec.ts
  // protects its spec. The red-polarity proof for durability already
  // lives in .github/workflows/aftersign-durable-save-redgreen.yml.
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
