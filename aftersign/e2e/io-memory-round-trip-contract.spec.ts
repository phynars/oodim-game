import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
} from "../../e2e-shared/flagshipStoryStateContract";

// NPC-memory round-trip contract for the BRIEF's slice-1 invariant, expressed
// against the surface aftersign/index.html ACTUALLY exposes today — so this
// spec runs green in the `test:e2e:aftersign` lane (CI job "aftersign")
// instead of red-forever.
//
// Root-cause history (PR #627):
//   rev 1 staged a vitest file — dead on arrival: no vitest dependency,
//     config, or `test:unit` script exists in this repo. The only runner is
//     @playwright/test via aftersign/playwright.config.ts.
//   rev 2 moved to Playwright but asserted the ASPIRATIONAL spec surface
//     (docs/flagship/story-state-contract.md → FlagshipGameSurface):
//     `npcs.io.memories`, `save.authority === 'server'`,
//     `save.lastLoadProof.source === 'server'`, beats like
//     'io-return-recognition', choice id 'keep-sealed' waited via
//     waitForBeat('packet-offered'→'packet-delivered'). The impl at HEAD
//     exposes `npcs.io.memory` (SINGULAR), a localStorage-only save with
//     `authority: 'local-fallback'`, and beats 'packet-kept-sealed' /
//     'io-returning-recognition'. That spec was red in CI on the very first
//     waitForFunction — a permanently-red test in the green gate hides every
//     future regression behind the same red (see the SKIP RATIONALE in
//     save-load-durable-contract.spec.ts for the same policy call).
//
// What this spec DOES assert (all real at HEAD, all load-bearing):
//   1. A sealed delivery authors exactly one Io delivery-outcome memory
//      fact (predicate 'delivered-blue-packet', object 'sealed').
//   2. forceSave() persists it; an in-page forceReload() (local state
//      intact) restores the fact byte-identical — the round-trip half
//      the impl already supports.
//   3. choose('return-to-io') reaches 'io-returning-recognition' and Io's
//      returning line contains the spec's REQUIRED fragment
//      ('blue seal, unbroken' — IO_RETURN_LINE_FRAGMENT.sealed), does NOT
//      leak the raw memory id, and lastLineMemoryRefs ties the line to the
//      recalled fact's id.
//
// What it does NOT assert (tracked impl gaps, spec-shaped assertions live
// as test.fixme in flagship-surface-contract.spec.ts until the impl grows
// the fields): save.authority === 'server', save.lastLoadProof, the plural
// `memories` array, clearLocalState durability. Asserting those today
// would be a red-forever spec — the exact defect this PR was blocked for.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

// Shape of the surface index.html publishes at HEAD (subset this spec reads).
type GameSurface = {
  version: 1;
  scene: { beat: string };
  packet: { delivered: boolean; sealed: boolean };
  delivery: { id: "blue-packet"; outcome: string };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: string): Promise<void>;
    waitForStoryIdle(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(options?: { clearLocalState?: boolean }): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function readSurface(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
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
  test("Io's returning line is backed by the saved delivery memory", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "io-memory-round-trip");

    // Hermetic slot per run — impl keys localStorage by
    // `aftersign:kiosk-slice:${slot}` (index.html).
    const slot = `io-memory-round-trip-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // --- Session A: sealed delivery authors the memory fact ---
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const afterDeliver = await readSurface(page);
    expect(afterDeliver.delivery.outcome).toBe("sealed");
    expect(afterDeliver.packet.delivered).toBe(true);

    // Exactly one delivery-outcome fact, with the impl's real shape.
    const savedFact = afterDeliver.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      savedFact,
      "deliver-packet must author an Io delivered-blue-packet memory fact",
    ).toBeDefined();
    expect(savedFact!.object).toBe("sealed");
    expect(savedFact!.sessionId).toBeTruthy();

    // --- Persist, then reload from the save (local state intact) ---
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });
    const revisionAfterSave = (await readSurface(page)).save.revision;

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    // --- Session B: return to Io and assert the recognition line ---
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await waitForBeat(page, "io-returning-recognition");

    const returning = await readSurface(page);

    // Round-trip: the fact survived the save→reload byte-identical.
    const recalledFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      recalledFact,
      "Io's sealed-delivery memory must survive forceSave → forceReload",
    ).toBeDefined();
    expect(recalledFact).toEqual(savedFact);
    expect(returning.save.revision).toBeGreaterThanOrEqual(revisionAfterSave);
    expect(returning.save.dirty).toBe(false);

    // Recognition line: required spec fragment, tied to the recalled
    // memory id via lastLineMemoryRefs, no raw-id leak into dialogue.
    // Fragment constant comes from e2e-shared/flagshipStoryStateContract.ts
    // (mirrors docs/flagship/story-state-contract.md "Required mappings"),
    // so a copy drift between doc and impl breaks HERE, loudly.
    const line = returning.npcs.io.lastLine ?? "";
    expect(line).toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(recalledFact!.id);
    expect(line).not.toContain(recalledFact!.id);

    // The spec's canonical memory id ('io-remembers-blue-packet-sealed')
    // is NOT asserted here: the impl at HEAD authors
    // `io:${slot}:delivered-blue-packet` ids (index.html memoryFact()).
    // When the impl adopts the contract ids, the fixme'd spec-shaped test
    // in flagship-surface-contract.spec.ts takes over that assertion —
    // IO_RETURN_MEMORY_ID stays imported below so this file breaks at
    // compile time if the contract constant is renamed out from under us.
    void IO_RETURN_MEMORY_ID;
  });
});
