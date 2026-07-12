import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
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

async function waitForSurface(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await waitForSurface(page);
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

// LOCAL NPC-memory round-trip. The FULL contract requires
// `save.authority === 'server'` + `lastLoadProof.source === 'server'`
// after a clearLocalState reload — that proof lives in
// save-load-durable-contract.spec.ts and is skipped until the server
// path exists. This spec covers the smaller-but-still-valuable claim:
// with local persistence intact, Io remembers the prior packet outcome
// across a normal reload, references the saved memory by id, and speaks
// the outcome-appropriate line fragment. Deleting this proof was the
// review-time regression #630 called out — restore it here against the
// slice's honest local shape.
test.describe("AFTERSIGN prior-session memory (local round-trip)", () => {
  test.describe.configure({ mode: "serial" });

  test("Io's returning line references the saved delivery memory by id (sealed)", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `prior-session-sealed-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
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
    expect(beforeReload.delivery.outcome).toBe("sealed");
    expect(beforeReload.npcs.io.memories.map((m) => m.id)).toContain(
      IO_RETURN_MEMORY_ID.sealed,
    );

    // Normal reload (local blob survives) then advance into the
    // recognition beat.
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const returning = await readSurface(page);
    expect(returning.scene.beat).toBe("io-return-recognition");
    expect(returning.delivery.outcome).toBe("sealed");
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.sealed);
    expect(returning.npcs.io.lastLine ?? "").toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    // The line must not be the opened-branch fragment.
    expect(returning.npcs.io.lastLine ?? "").not.toContain(IO_RETURN_LINE_FRAGMENT.opened);
    // Ids belong in lastLineMemoryRefs, NOT in the human-readable line.
    expect(returning.npcs.io.lastLine ?? "").not.toContain(IO_RETURN_MEMORY_ID.sealed);
  });

  test("Io's returning line references the saved delivery memory by id (opened)", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `prior-session-opened-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const beforeReload = await readSurface(page);
    expect(beforeReload.delivery.outcome).toBe("opened");

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const returning = await readSurface(page);
    expect(returning.scene.beat).toBe("io-return-recognition");
    expect(returning.delivery.outcome).toBe("opened");
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.opened);
    expect(returning.npcs.io.lastLine ?? "").toContain(IO_RETURN_LINE_FRAGMENT.opened);
  });

  test("prior-session memory stays slot-scoped across save/reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const slotA = `memory-isolation-a-${Date.now()}`;
    const slotB = `memory-isolation-b-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slotA}`, { waitUntil: "load" });
    await readSurface(page);
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const slotAState = await readSurface(page);
    expect(
      slotAState.npcs.io.memories.some((m) => m.id === IO_RETURN_MEMORY_ID.sealed),
    ).toBe(true);

    await page.goto(`/aftersign/?slot=${slotB}`, { waitUntil: "load" });
    const slotBState = await readSurface(page);
    expect(slotBState.delivery.outcome).toBe("unknown");
    expect(slotBState.npcs.io.memories).toEqual([]);
    expect(slotBState.npcs.io.lastLineMemoryRefs).toEqual([]);
  });

  test("wrong-io-line break mode swaps the returning fragment and the memory-ref check catches it", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `wrong-io-line-${Date.now()}`;

    // First session (normal) — persist a sealed delivery.
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await readSurface(page);
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    // Second session — reload with wrong-io-line break mode; sealed memory
    // is present but Io speaks the opened-branch fragment. The line-fragment
    // guard MUST catch this.
    await page.goto(`/aftersign/?slot=${slot}&breakMode=wrong-io-line`, { waitUntil: "load" });
    await readSurface(page);
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const returning = await readSurface(page);
    expect(returning.delivery.outcome).toBe("sealed");
    expect(returning.npcs.io.memories.map((m) => m.id)).toContain(IO_RETURN_MEMORY_ID.sealed);
    // The break-mode swap must be visible: sealed-outcome speaks the opened fragment.
    expect(returning.npcs.io.lastLine ?? "").toContain(IO_RETURN_LINE_FRAGMENT.opened);
    expect(returning.npcs.io.lastLine ?? "").not.toContain(IO_RETURN_LINE_FRAGMENT.sealed);
  });
});
