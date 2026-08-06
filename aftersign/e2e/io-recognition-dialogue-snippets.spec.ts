import { test, expect, Page } from "@playwright/test";

type Beat = "packet-offered" | "packet-choice" | "packet-delivered" | "io-return-recognition";
type Tier = "first-meeting" | "returning" | "deep-recall";

type RecognitionDialogueSnippet = {
  id: string;
  playerId: string;
  npcId: "io";
  tier: Tier;
  line: string;
  // Citation set — mirrored into `npcs.io.lastLineMemoryRefs` when the
  // tier is spoken. Contract-clean (delivery id only, no route-attention).
  memoryRefs: string[];
  // Provenance set — which memory facts influenced the LINE choice.
  // Deep-recall carries >=2 here (delivery + route-attention).
  sourceMemoryIds: string[];
};

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  player: { id: string };
  npcs: {
    io: {
      lastLine: string | null;
      lastLineMemoryRefs: string[];
      recognitionDialogueSnippets: RecognitionDialogueSnippet[];
    };
  };
  input: {
    choose(choiceId: "keep-packet-sealed" | "acknowledge-kiosk" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
    advance(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("Io recognition beat exposes player-keyed dialogue snippets for all recall tiers", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto(`/aftersign/?slot=io-dialogue-snippets-${Date.now()}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-choice");
  await page.evaluate(() => window.__game!.input.choose("acknowledge-kiosk"));
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");
  await page.evaluate(() => window.__game!.input.forceSave());
  await page.evaluate(() => window.__game!.input.forceReload());
  await page.evaluate(() => window.__game!.input.advance());
  await waitForBeat(page, "io-return-recognition");

  const snapshot = await page.evaluate(() => window.__game as GameSurface);
  const snippets = snapshot.npcs.io.recognitionDialogueSnippets;

  expect(snippets.map((snippet) => snippet.tier)).toEqual([
    "first-meeting",
    "returning",
    "deep-recall",
  ]);
  expect(snippets.every((snippet) => snippet.playerId === snapshot.player.id)).toBe(true);
  expect(snippets.every((snippet) => snippet.npcId === "io")).toBe(true);
  expect(snippets.every((snippet) => snippet.line.trim().length > 0)).toBe(true);

  const returning = snippets.find((snippet) => snippet.tier === "returning")!;
  const deepRecall = snippets.find((snippet) => snippet.tier === "deep-recall")!;

  // memoryRefs is the CITATION set — contract-clean, delivery id only.
  expect(returning.memoryRefs.length).toBeGreaterThanOrEqual(1);
  expect(deepRecall.memoryRefs).toEqual(returning.memoryRefs);
  // sourceMemoryIds is the wider provenance — deep-recall draws on
  // both delivery-outcome AND route-attention memories.
  expect(deepRecall.sourceMemoryIds.length).toBeGreaterThanOrEqual(2);

  // This spec exercises the `acknowledge-kiosk` path (route-attention
  // object === "done"), so the selector speaks the deep-recall tier
  // and mirrors its (delivery-only) memoryRefs into lastLineMemoryRefs.
  expect(snapshot.npcs.io.lastLine).toBe(deepRecall.line);
  expect(snapshot.npcs.io.lastLineMemoryRefs).toEqual(deepRecall.memoryRefs);
});
