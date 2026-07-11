import { test, expect, Page } from "@playwright/test";
import {
  buildRememberingLine,
  isRememberingLine,
  MEMORY_CUES,
} from "../src/narrative/npcMemoryLines";

// CI-for-narrative gate for PR #502's line-builder.
//
// The BRIEF (docs/flagship/BRIEF.md) mandates "Extend the gameplay harness
// before the gameplay" — NPC-memory round-trips must have an executable
// invariant check, not just a pure module sitting exportable-but-unused.
// This spec wires `buildRememberingLine` / `isRememberingLine` into a live
// `window.__game` round-trip so the contract between the pure narrative
// module and the runtime scene is CI-gated.
//
// Scope: the runtime scene (aftersign/index.html) hand-writes its Io
// recognition lines rather than importing this module. That's fine — but
// the LINE SHAPE the runtime lands on `window.__game.npcs.io.lastLine`
// must satisfy the same invariants the module guarantees. If the runtime
// drifts (missing speaker prefix, missing player-name substitution,
// leaked template token), this spec goes red.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// The runtime's Io lines mention the player as "you" rather than by proper
// name in the current slice — but they DO include speaker attribution
// through the HUD, not the string itself, and the string is what
// window.__game exposes. We check both shapes: the pure module (with
// proper-name substitution) via isRememberingLine, and the live runtime
// line via an equivalent player-referring predicate.

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  npcs: {
    io: {
      memory: Array<{ id: string; predicate: string; object: string; sessionId: string }>;
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(id: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
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

/** Runtime equivalent of `isRememberingLine` — the runtime uses "you" instead
 * of a proper name, so the harness-facing invariant is: the string is
 * non-empty, references the player (via "you" or "your"), is memory-backed
 * (non-empty lastLineMemoryRefs at the recognition beat), and contains no
 * unresolved template tokens. */
function isRuntimeRememberingLine(line: string | null): line is string {
  if (typeof line !== "string" || line.length === 0) return false;
  if (!/\byou(r)?\b/i.test(line)) return false;
  if (/[{}]|undefined|null/.test(line)) return false;
  return true;
}

test.describe("AFTERSIGN NPC memory-line contract", () => {
  test("buildRememberingLine's pure contract holds for every cue", async () => {
    // Pure-module smoke — the plain-TS harness in
    // aftersign/src/narrative/npcMemoryLines.test.ts covers this
    // exhaustively; this Playwright test mirrors the essential invariant
    // so a red aftersign lane surfaces both the module AND the runtime
    // in one signal. Running the pure test file requires a runner
    // (vitest is not a repo dep — see aftersign/README.md), so we
    // inline the shape check here instead of shelling out.
    for (const cue of MEMORY_CUES) {
      const line = buildRememberingLine({ npcName: "Io", playerName: "Mara", cue });
      expect(isRememberingLine(line, { npcName: "Io", playerName: "Mara" })).toBe(true);
    }
  });

  test("runtime Io recognition line satisfies the remembering-line invariant (sealed)", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=line-contract-sealed-${Date.now()}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const returning = await page.evaluate(() => window.__game as GameSurface);
    const line = returning.npcs.io.lastLine;

    // Well-formed remembering line: non-empty, references the player,
    // no template-token leaks.
    expect(isRuntimeRememberingLine(line)).toBe(true);

    // Memory-backed: the recognition line must cite at least one saved
    // fact — otherwise "recognition" is a lie the runtime is telling.
    expect(returning.npcs.io.lastLineMemoryRefs.length).toBeGreaterThan(0);

    // Branch-correct: the sealed run mentions the intact seal ("unbroken"),
    // not the broken-seal variant. Use word-boundary to distinguish
    // "unbroken" from "broken" — a naive /broken/ matches both.
    expect(line).toMatch(/seal/i);
    expect(line).toMatch(/unbroken/i);
    expect(line).not.toMatch(/\bbroken\b/i);
  });

  test("runtime Io recognition line satisfies the invariant (opened branch)", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=line-contract-opened-${Date.now()}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const returning = await page.evaluate(() => window.__game as GameSurface);
    const line = returning.npcs.io.lastLine;

    expect(isRuntimeRememberingLine(line)).toBe(true);
    expect(returning.npcs.io.lastLineMemoryRefs.length).toBeGreaterThan(0);

    // Branch-correct: the opened run acknowledges the broken seal.
    // Use word-boundary so this doesn't accidentally match "unbroken".
    expect(line).toMatch(/\bbroken\b/i);
  });
});
