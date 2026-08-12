import { test, expect, Page } from "@playwright/test";

type Beat = "packet-offered" | "packet-choice" | "packet-delivered" | "io-return-recognition";
type Tier = "first-meeting" | "returning" | "deep-recall";

// Snippet-authored per-tier motion values (see
// aftersign/src/ioRecognitionDialogue.ts :: IoRecognitionSnippetFeelCue).
// The dialogue module authors ms/deg/alpha numbers per tier; main.js
// mirrors the SELECTED snippet's feelCue into `--io-recognition-*` CSS
// custom properties AND into `npcs.io.lastLineFeelCue`, so this contract
// is what the served surface actually feels.
type SnippetFeelCue = {
  durationMs: number;
  holdFrames: number;
  cameraDollyCm: number;
  cameraYawDegrees: number;
  vignetteAlpha: number;
  bloomAlpha: number;
  lineRevealDelayMs: number;
  lineRevealDurationMs: number;
  easing: "cubic-bezier(.2,.8,.2,1)";
};

type RecognitionDialogueSnippet = {
  id: string;
  playerId: string;
  npcId: "io";
  tier: Tier;
  line: string;
  // Per-tier authored feel numbers. First-meeting is the smallest cue
  // (~480ms), returning is medium (~820ms), deep-recall is the biggest
  // (~1040ms). We assert those numbers are monotonically bigger tier
  // over tier — no drift between "how recognized the player feels"
  // and "how big the beat plays".
  feelCue: SnippetFeelCue;
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
      // The feelCue of the snippet the selector CHOSE this beat —
      // null off-beat, populated at `io-return-recognition` from the
      // SAME snippet that supplied lastLine / lastLineMemoryRefs.
      lastLineFeelCue: SnippetFeelCue | null;
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

  // --- feelCue is a WIRED consumer contract, not decoration -----------
  // Every snippet carries a well-formed, non-degenerate feelCue with the
  // shared cubic-bezier easing token. If a tier ever ships zeroed
  // numbers this catches it.
  const firstMeeting = snippets.find((snippet) => snippet.tier === "first-meeting")!;
  for (const snippet of [firstMeeting, returning, deepRecall]) {
    expect(snippet.feelCue.durationMs).toBeGreaterThan(0);
    expect(snippet.feelCue.holdFrames).toBeGreaterThan(0);
    expect(snippet.feelCue.cameraDollyCm).toBeGreaterThan(0);
    expect(snippet.feelCue.cameraYawDegrees).toBeGreaterThan(0);
    expect(snippet.feelCue.vignetteAlpha).toBeGreaterThan(0);
    expect(snippet.feelCue.bloomAlpha).toBeGreaterThan(0);
    expect(snippet.feelCue.lineRevealDelayMs).toBeGreaterThan(0);
    expect(snippet.feelCue.lineRevealDurationMs).toBeGreaterThan(0);
    expect(snippet.feelCue.easing).toBe("cubic-bezier(.2,.8,.2,1)");
  }

  // Monotonic feel-escalation: the more Io recognizes the player, the
  // bigger the beat plays. If someone ever authors a deep-recall cue
  // smaller than the returning cue, this fails.
  expect(returning.feelCue.durationMs).toBeGreaterThan(firstMeeting.feelCue.durationMs);
  expect(deepRecall.feelCue.durationMs).toBeGreaterThan(returning.feelCue.durationMs);
  expect(returning.feelCue.cameraDollyCm).toBeGreaterThan(firstMeeting.feelCue.cameraDollyCm);
  expect(deepRecall.feelCue.cameraDollyCm).toBeGreaterThan(returning.feelCue.cameraDollyCm);
  expect(returning.feelCue.cameraYawDegrees).toBeGreaterThan(firstMeeting.feelCue.cameraYawDegrees);
  expect(deepRecall.feelCue.cameraYawDegrees).toBeGreaterThan(returning.feelCue.cameraYawDegrees);

  // The runtime must publish the SELECTED tier's feelCue into
  // `npcs.io.lastLineFeelCue` — same source as lastLine — and drive
  // the `--io-recognition-*` DOM custom properties from those numbers.
  // If main.js ever drifts back to publishing snippets without wiring
  // them, both halves of this assertion fail together.
  expect(snapshot.npcs.io.lastLineFeelCue).toEqual(deepRecall.feelCue);

  const cssVars = await page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      durationMs: style.getPropertyValue("--io-recognition-duration-ms").trim(),
      cameraDollyCm: style.getPropertyValue("--io-recognition-camera-dolly-cm").trim(),
      cameraYawDeg: style.getPropertyValue("--io-recognition-camera-yaw-deg").trim(),
      vignetteAlpha: style.getPropertyValue("--io-recognition-vignette-alpha").trim(),
      bloomAlpha: style.getPropertyValue("--io-recognition-bloom-alpha").trim(),
      lineRevealDelayMs: style.getPropertyValue("--io-recognition-line-reveal-delay-ms").trim(),
      lineRevealDurationMs: style.getPropertyValue("--io-recognition-line-reveal-duration-ms").trim(),
      easing: style.getPropertyValue("--io-recognition-easing").trim(),
    };
  });
  expect(cssVars.durationMs).toBe(`${deepRecall.feelCue.durationMs}ms`);
  expect(cssVars.cameraDollyCm).toBe(`${deepRecall.feelCue.cameraDollyCm}`);
  expect(cssVars.cameraYawDeg).toBe(`${deepRecall.feelCue.cameraYawDegrees}`);
  expect(cssVars.vignetteAlpha).toBe(`${deepRecall.feelCue.vignetteAlpha}`);
  expect(cssVars.bloomAlpha).toBe(`${deepRecall.feelCue.bloomAlpha}`);
  expect(cssVars.lineRevealDelayMs).toBe(`${deepRecall.feelCue.lineRevealDelayMs}ms`);
  expect(cssVars.lineRevealDurationMs).toBe(`${deepRecall.feelCue.lineRevealDurationMs}ms`);
  expect(cssVars.easing).toBe(deepRecall.feelCue.easing);
});
