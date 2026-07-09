import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
  assertDurableSaveLoaded,
  assertNpcReferencesPriorMemory,
  assertSerializableFlagshipSurface,
  assertStoryBeatTransition,
  getFlagshipSurface,
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
// STATUS: all three tests below are `test.fixme` because the current
// impl at aftersign/index.html publishState() exposes a smaller shape
// than FlagshipGameSurface (no scene.act/ready, no player/delivery/save
// blocks, npcs.io.memory not memories, choice id 'keep-packet-sealed'
// not 'keep-sealed'). Running these tests unfixmed would crash on the
// first choose() call before any assertion fires, painting the whole
// aftersign lane red and blocking every other aftersign PR.
//
// The `fixme` marker is the honest signal: "this assertion is authored
// against a surface that doesn't exist yet, don't run it, and don't
// forget it either." Playwright emits a skip in the report so the gap
// stays visible on every run — this is louder than a comment.
//
// Tracked by #563 (parent) with per-phase children:
//   Phase 1 (#564) — scene.act + scene.ready + player block
//                 → unfixme test #1 (story-state invariant)
//   Phase 2 (#565) — delivery.outcome + input helpers
//                 → keeps test #1 green
//   Phase 3 (#566) — npcs.io.memories + Io returning-line
//                 → unfixme test #2 (npc-memory round-trip)
//   Phase 4 (#567) — save.authority + lastLoadProof + FLAGSHIP_BREAK_MODE
//                 → unfixme test #3 (durable save/load)
//
// The Galaga rule the founder wrote into the brief — "no beat exists
// unless a harness assertion says so, and the assertion must exist
// BEFORE the beat" — is honored by keeping the assertion body intact
// and the shared contract types load-bearing. Each phase PR flips one
// fixme to a live `test` in the same diff that lands the field, so the
// harness catches the regression from the moment the field exists.
//
// FLAGSHIP_BREAK_MODE red-polarity: when the env var is set to a
// recognized break-mode value, the corresponding assertion is INVERTED
// — the test only passes if the surface fails in the specified way.
// That's how CI proves "our green test would actually go red if the
// impl regressed" without shipping a permanently-failing job. The
// vite wire-up is Phase 4 (#567).

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

  // Unfixme in Phase 1 (#564) once scene.act, scene.ready, and the
  // player block exist. Phase 2 (#565) then makes the delivery.outcome
  // and input-helper assertions non-crashing.
  test("story-state invariant: sealed delivery advances the authored beats", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "story-state-invariant");
    const breakMode = currentBreakMode();

    await page.goto(`/aftersign/?slot=flagship-story-${Date.now()}`, { waitUntil: "load" });

    const initial = await readSurface(page);
    assertSerializableFlagshipSurface(initial);

    expect(initial.scene.beat === "arrival" || initial.scene.beat === "packet-offered").toBe(true);
    expect(initial.delivery.outcome).toBe("unknown");

    // Drive the sealed branch: keep-sealed → deliver-packet.
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterChoice = await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterDeliver = await readSurface(page);

    // Spec: "Required tests" #1 assertions.
    assertStoryBeatTransition(afterChoice, afterDeliver, "packet-delivered", "io_intro_seen");
    expect(afterDeliver.delivery.outcome).toBe("sealed");
    expect(afterDeliver.npcs.io.trustPosture).toBe("trusted-seal");

    if (breakMode === "wrong-io-line") {
      // In the wrong-io-line break, the spec expects Io's line to
      // eventually contradict the sealed memory. The story-invariant
      // test proves the pre-return story is still coherent though;
      // this branch just documents intent (assertion belongs to the
      // returning-session test below).
    }
  });

  // Unfixme in Phase 3 (#566) once npcs.io.memories, npcs.io.lastLine,
  // npcs.io.lastLineMemoryRefs, and npcs.io.trustPosture are populated
  // on the return-to-io beat.
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
      // Impl was told to drop the memory: the sealed memory must be
      // absent, so the assertion below must throw. If it did NOT throw
      // then the break mode is not actually broken, which is itself a
      // failure. Convert the polarity here.
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

    // Green path: the spec's "Required tests" #2 sealed branch.
    assertNpcReferencesPriorMemory(returning, "sealed");

    // Redundant explicit assertions so a failure message points to the
    // exact rule that broke:
    expect(returning.npcs.io.lastLine).toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.sealed);
    expect(returning.save.lastLoadProof.source).toBe("server");
  });

  // Unfixme in Phase 4 (#567) once save.authority, save.lastLoadProof,
  // input.forceSave/forceReload, and the FLAGSHIP_BREAK_MODE vite
  // wire-up exist.
  test.fixme("durable save/load: authoritative reload survives clearLocalState", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-save-load");
    const breakMode = currentBreakMode();

    const slot = `flagship-durable-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;

    await page.goto(url, { waitUntil: "load" });
    await readSurface(page);

    // 1+2. Mutate a flag and author an Io delivery-outcome memory via
    //      harness input.
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    // 3. forceSave.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const beforeReload = await readSurface(page);
    assertSerializableFlagshipSurface(beforeReload);

    // Pre-reload sanity: save is server-authoritative on the way OUT
    // too — a local-fallback save can't be reasoned about as durable.
    expect(beforeReload.save.authority).toBe("server");
    expect(beforeReload.delivery.outcome).toBe("sealed");
    expect(beforeReload.save.dirty).toBe(false);

    // 4+5. Capture revision, then durable reload with clearLocalState.
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

    // 6. Assertions per spec #3.
    assertDurableSaveLoaded(beforeReload, afterReload);
  });
});
