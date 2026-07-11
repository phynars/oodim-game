import { expect, test, type Page } from "@playwright/test";

// STORY/STATE surface contract for the WebGL-headless harness.
//
// The real surface (aftersign/index.html publishState()) is:
//   window.__game = {
//     version: 1,
//     slug: "aftersign",           // top-level string
//     scene: { id, beat },         // beat is the story beat string
//     npcs: { io: { memory: [{ id, predicate, object, sessionId }, ...] } },
//     ...
//   }
//
// Story beat lives at `scene.beat`, not at a fabricated top-level
// `storyBeat`. Session id lives inside memory facts (`npcs.io.memory[i]
// .sessionId`), not at a top-level `sessionId`. This spec asserts the
// contract THROUGH those real paths so the harness catches drift if the
// shape ever regresses — no invented keys.

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
  slug: string;
  scene: { id: string; beat: Beat };
  npcs: { io: { memory: MemoryFact[] } };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("window.__game exposes story/state contract fields for harness assertions", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const slot = `story-state-surface-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`);

  await waitForBeat(page, "packet-offered");

  // Snapshot the fields the harness will assert against.
  const initial = await page.evaluate(() => {
    const game = window.__game!;
    return {
      slug: game.slug,
      sceneBeat: game.scene.beat,
      memoryLength: game.npcs.io.memory.length,
    };
  });

  // Top-level `slug` is the durable game identity string.
  expect(typeof initial.slug).toBe("string");
  expect(initial.slug).toBe("aftersign");

  // Story beat is a string at scene.beat (not top-level storyBeat).
  expect(typeof initial.sceneBeat).toBe("string");
  expect(initial.sceneBeat).toBe("packet-offered");

  // Memory starts empty on a fresh slot; sessionId lives INSIDE memory
  // facts once they exist, not as a top-level field.
  expect(initial.memoryLength).toBe(0);

  // Drive delivery so a memory fact is minted, then assert sessionId
  // sits at its real nested address and is a non-empty string tied to
  // the slot.
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-kept-sealed");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  await page.waitForFunction(
    () => (window.__game?.npcs.io.memory.length ?? 0) > 0,
    undefined,
    { timeout: WAIT_MS },
  );

  const after = await page.evaluate(() => {
    const fact = window.__game!.npcs.io.memory[0];
    return {
      sessionId: fact.sessionId,
      predicate: fact.predicate,
    };
  });

  expect(typeof after.sessionId).toBe("string");
  expect(after.sessionId).toBe(`session-${slot}`);
  expect(after.predicate).toBe("delivered-blue-packet");
});
