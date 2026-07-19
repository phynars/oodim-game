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
//
// Timing note: deliverPacket() persists beat="packet-delivered" synchronously
// and then schedules a setBeat("io-return-recognition") after 1180ms
// (aftersign/index.html — deliverPacket()). That timeout mutates the live
// state.scene.beat but does NOT call persist(), so the durable save stays
// at "packet-delivered" ONLY if forceSave() runs before the 1180ms fires —
// otherwise forceSave persists at beat="io-return-recognition". Cross-RPC
// hops from Playwright can easily exceed that budget in CI. This spec
// therefore mints + saves in a SINGLE page.evaluate (no RPC boundary between
// deliver and forceSave), and treats either persisted beat ("packet-delivered"
// or "io-return-recognition") as valid — the invariant we prove is the
// MEMORY-FACT round-trip, not which beat the timer landed on.

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

    // Drive delivery + forceSave in a SINGLE evaluate to race ahead of
    // deliverPacket()'s 1180ms setBeat("io-return-recognition") timeout.
    // If we split these across RPC hops, CI latency can push forceSave to
    // persist beat="io-return-recognition" instead of "packet-delivered",
    // which is a legitimate outcome but shifts what session B loads.
    // Colocating keeps session A's saved beat deterministic.
    const sessionAResult = await page.evaluate(async () => {
      await window.__game!.input.choose("deliver-packet");
      await window.__game!.input.forceSave();
      const snapshot = window.__game!;
      return {
        beat: snapshot.scene.beat,
        revision: snapshot.save.revision,
        dirty: snapshot.save.dirty,
        memory: snapshot.npcs.io.memory,
      };
    });

    expect(sessionAResult.dirty).toBe(false);
    const mintedFact = sessionAResult.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(mintedFact, "session A must mint a delivered-blue-packet MemoryFact").toBeTruthy();
    expect(mintedFact!.object).toBe("sealed");
    expect(mintedFact!.id).toBeTruthy();
    expect(mintedFact!.sessionId).toBe(`session-${slot}`);
    const persistedRevision = sessionAResult.revision;

    // ---- Hard session boundary: full fresh navigation, NOT the in-page
    // forceReload helper. Everything session B sees must come off the save. ----
    await page.goto("about:blank");
    await page.goto(url, { waitUntil: "load" });

    const sessionB = await game(page);

    // Persisted beat is either "packet-delivered" (durable delivery beat)
    // or "io-return-recognition" if session A's 1180ms setBeat fired before
    // forceSave() persisted. Either is a valid saved state; the memory
    // round-trip is what matters.
    expect(
      sessionB.scene.beat === "packet-delivered"
        || sessionB.scene.beat === "io-return-recognition",
    ).toBe(true);
    expect(sessionB.save.revision).toBe(persistedRevision);
    expect(sessionB.save.dirty).toBe(false);

    // The fact recalled in session B is the PRIOR session's fact — byte
    // identical, same id, same sessionId — not one re-minted post-boundary.
    const recalledFact = sessionB.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(recalledFact).toEqual(mintedFact);

    // ---- Session B reaches recognition; the line is memory-backed. ----
    // If the loaded beat is already "io-return-recognition" (session A's
    // 1180ms timer had fired), we're already there. Otherwise advance().
    if (sessionB.scene.beat !== "io-return-recognition") {
      await page.evaluate(() => window.__game!.input.advance());
      await waitForBeat(page, "io-return-recognition");
    }

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
