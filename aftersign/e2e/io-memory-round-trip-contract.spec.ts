import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
  assertDurableSaveLoaded,
  assertNpcReferencesPriorMemory,
  assertSerializableFlagshipSurface,
  type FlagshipGameSurface,
  type FlagshipSceneBeat,
} from "../../e2e-shared/flagshipStoryStateContract";

// Failing-first harness assertion for the BRIEF's NPC-memory round-trip
// invariant. Sourced from docs/flagship/story-state-contract.md — the
// AUTHORITATIVE surface — via e2e-shared/flagshipStoryStateContract.ts.
//
// Why here (not vitest): the repo's test runner is @playwright/test.
// vitest is not installed, has no config, and no `test:unit` script —
// anything imported from 'vitest' is dead code. See PR #627 review.
//
// This spec is RED until impl provides:
//   - window.__game.version === 1 with the full FlagshipGameSurface
//   - npcs.io.memories including 'io-remembers-blue-packet-sealed'
//     with source: 'server'
//   - npcs.io.lastLineMemoryRefs referencing that id
//   - npcs.io.lastLine containing 'blue seal, unbroken' (not the id)
//   - save.authority === 'server' and save.lastLoadProof.source === 'server'
//     after a forceReload({ clearLocalState: true })
//
// The point of the red is that "the NPC remembers" is not a story beat
// until this assertion says so.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: FlagshipSceneBeat): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const g = (window as unknown as { __game?: { version?: number; scene?: { beat?: string } } })
        .__game;
      return g?.version === 1 && g.scene?.beat === expected;
    },
    beat,
    { timeout: WAIT_MS },
  );
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { version?: number } }).__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
  return page.evaluate(() => {
    // The surface must be plain data — see assertSerializableFlagshipSurface.
    // We rely on Playwright's structured-clone serialization to enforce it.
    const g = (window as unknown as { __game?: unknown }).__game;
    return g as FlagshipGameSurface;
  });
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

test.describe("AFTERSIGN Io memory round-trip contract (BRIEF slice 1)", () => {
  test("Io references the prior sealed delivery via the real FlagshipGameSurface", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "io-memory-round-trip");

    const slot = `io-memory-round-trip-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // The BRIEF requires window.__game to be the authoritative harness
    // surface. Getting to a returning-session recognition beat is impl's
    // job; this spec's job is to assert the contract when we get there.

    // Drive the flagship first-session flow: offer -> keep sealed -> deliver.
    await waitForBeat(page, "packet-offered");
    await page.evaluate(async () => {
      await (window as unknown as {
        __game: { input: { choose: (id: string) => Promise<void> } };
      }).__game.input.choose("keep-sealed");
    });
    await page.evaluate(async () => {
      await (window as unknown as {
        __game: { input: { choose: (id: string) => Promise<void> } };
      }).__game.input.choose("deliver-packet");
    });
    await waitForBeat(page, "packet-delivered");

    // Persist and prove durability by clearing local state on reload.
    await page.evaluate(async () => {
      await (window as unknown as {
        __game: { input: { forceSave: () => Promise<void> } };
      }).__game.input.forceSave();
    });
    await page.waitForFunction(
      () =>
        (window as unknown as { __game?: { save?: { dirty?: boolean } } }).__game?.save?.dirty ===
        false,
      undefined,
      { timeout: WAIT_MS },
    );

    const beforeSave = await readSurface(page);
    assertSerializableFlagshipSurface(beforeSave);
    expect(beforeSave.delivery.outcome).toBe("sealed");
    expect(beforeSave.save.authority).toBe("server");

    await page.evaluate(async () => {
      await (window as unknown as {
        __game: { input: { forceReload: (opts?: { clearLocalState?: boolean }) => Promise<void> } };
      }).__game.input.forceReload({ clearLocalState: true });
    });

    // Enter the returning-session recognition beat.
    await waitForBeat(page, "io-return-recognition");

    const afterLoad = await readSurface(page);
    assertSerializableFlagshipSurface(afterLoad);

    // Contract 1: durable save/load — server authority survived a
    // clearLocalState reload, revision + flags + memories intact.
    // (getFlagshipSurface is the in-browser guard; here we've already
    // pulled the surface into Node via readSurface, so pass the
    // deserialized snapshots directly.)
    assertDurableSaveLoaded(beforeSave, afterLoad);

    // Contract 2: Io's returning line is backed by the saved memory id
    // AND contains the authored fragment (not the raw id).
    assertNpcReferencesPriorMemory(afterLoad, "sealed");

    // Belt-and-suspenders — surface the required constants at the spec
    // level so a swap breaks here loudly rather than deep in the helper.
    expect(afterLoad.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.sealed);
    expect(afterLoad.npcs.io.lastLine ?? "").toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    expect(afterLoad.npcs.io.lastLine ?? "").not.toContain(IO_RETURN_MEMORY_ID.sealed);
  });
});
