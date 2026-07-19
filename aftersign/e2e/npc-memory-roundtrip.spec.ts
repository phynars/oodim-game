import { test, expect, Page } from "@playwright/test";

// NPC-memory ROUND-TRIP across a hard session boundary.
//
// Differentiator vs siblings (each spec owns one invariant):
//   - memory-prior-session.spec.ts proves recall across the in-page
//     `forceReload()` helper, and separately that state survives a
//     `page.reload()` — but never that the RECOGNITION LINE fires after
//     a hard boundary.
//   - flagship-surface-contract.spec.ts proves the flagship-shaped
//     surface (`npcs.io.memories`, clearLocalState) — a different
//     contract shape.
// This spec closes the remaining gap PR #720's reviewers named: session A
// mints a MemoryFact (aftersign/src/state-contract.ts — id / predicate /
// object / sessionId), the page is torn down by a FULL fresh navigation
// (a genuinely new session, no in-page helper), and session B proves Io's
// recognition line is backed by THAT prior-session fact — same id, same
// sessionId — not a fact re-minted after the boundary.

// Cold-start budget: SwiftShader init + first WebGL context can exceed
// Playwright's default timeout in CI even when story/state logic is correct.
const COLD_START_MS = 90_000;
// Per-wait budget for any single window.__game observation.
const WAIT_MS = 60_000;

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  packet: { sealed: boolean };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function game(page: Page): Promise<GameSurface> {
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

test.describe("AFTERSIGN npc-memory round-trip (hard session boundary)", () => {
  test("a MemoryFact minted in session A backs Io's recognition line in a fresh session B", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "npc-memory-roundtrip");

    const slot = `npc-memory-roundtrip-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;

    // ---- Session A: sealed delivery mints the fact; persist it. ----
    await page.goto(url, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const sessionA = await game(page);
    const mintedFact = sessionA.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(mintedFact, "session A must mint a delivered-blue-packet MemoryFact").toBeTruthy();
    expect(mintedFact!.object).toBe("sealed");
    expect(mintedFact!.id).toBeTruthy();
    expect(mintedFact!.sessionId).toBeTruthy();

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });
    const persistedRevision = (await game(page)).save.revision;

    // ---- Hard session boundary: full fresh navigation, NOT the in-page
    // forceReload helper. Everything session B sees must come off the save. ----
    await page.goto("about:blank");
    await page.goto(url, { waitUntil: "load" });

    const sessionB = await game(page);
    expect(sessionB.scene.beat).toBe("packet-delivered");
    expect(sessionB.save.revision).toBe(persistedRevision);
    expect(sessionB.save.dirty).toBe(false);

    // The fact recalled in session B is the PRIOR session's fact — byte
    // identical, same id, same sessionId — not one re-minted post-boundary.
    const recalledFact = sessionB.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(recalledFact).toEqual(mintedFact);

    // ---- Session B reaches recognition; the line is memory-backed. ----
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-return-recognition");

    const returning = await game(page);
    expect(returning.npcs.io.lastLineMemoryRefs).toEqual([mintedFact!.id]);

    const recognitionLine = returning.npcs.io.lastLine;
    expect(recognitionLine).toContain("blue seal, unbroken");
    // Diegetic line only — no bookkeeping leakage (raw ids belong in
    // lastLineMemoryRefs, never in dialogue).
    expect(recognitionLine).not.toContain(mintedFact!.id);
    expect(recognitionLine).not.toMatch(/memory|system|save/i);
  });
});
