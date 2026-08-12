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

  // --- The DOM envelope is WIRED, not a closed loop ------------------
  // Mara's #1139 review: writing --io-recognition-* onto documentElement
  // means nothing unless CSS rules on the shipped surface actually
  // consume them. Read the computed styles of the REAL rendered
  // elements the index.html rules touch and prove the snippet-side
  // numbers propagated to what the player sees.
  const consumed = await page.evaluate(() => {
    const panel = document.querySelector(".panel");
    const line = document.querySelector(".line");
    const hud = document.querySelector(".hud");
    if (!panel || !line || !hud) return null;
    const panelStyle = getComputedStyle(panel);
    const lineStyle = getComputedStyle(line);
    // body::after is the vignette — read pseudo-element styles.
    const vignetteStyle = getComputedStyle(document.body, "::after");
    return {
      // .panel.transform gets the dolly + yaw baked in — non-identity
      // matrix means CSS is applying the snippet numbers.
      panelTransform: panelStyle.transform,
      // Bloom lives in box-shadow's last shadow (the warm ring).
      panelBoxShadow: panelStyle.boxShadow,
      // .panel.transition references --io-recognition-line-reveal-*.
      panelTransition: panelStyle.transitionDuration,
      panelTransitionDelay: panelStyle.transitionDelay,
      // .line has its own reveal transition on opacity + letter-spacing.
      lineTransitionDuration: lineStyle.transitionDuration,
      lineTransitionDelay: lineStyle.transitionDelay,
      // body::after (vignette) — opacity should equal vignetteAlpha.
      vignetteOpacity: vignetteStyle.opacity,
      // .hud transition-duration list should contain the snippet's
      // overall durationMs — this proves --io-recognition-duration-ms
      // is consumed (the other 6 vars are covered by other assertions).
      hudTransitionDuration: getComputedStyle(hud).transitionDuration,
    };
  });
  expect(consumed).not.toBeNull();
  // Panel transform is non-identity: haptic-scale is 1 off-recognition
  // (recognition-dom-feedback.js only writes it during the recognition
  // feedback envelope), but the snippet's translateZ + rotateY leave a
  // 3D matrix even when scale === 1. Any of matrix3d(, matrix( with
  // non-zero z/rotation, or a compound "scale(…) translateZ(…) …"
  // string means the transform property was resolved from the vars.
  expect(consumed!.panelTransform).not.toBe("none");
  // The bloom's warm ring color is only present when bloomAlpha > 0.
  // Deep-recall bloomAlpha=0.16 ⇒ rgba(255,214,151,0.576) appears in
  // the box-shadow list. We assert the warm color token is present so
  // "bloomAlpha === 0 quietly zeros the ring" fails loudly if regressed.
  expect(consumed!.panelBoxShadow).toMatch(/rgba?\(\s*255\s*,\s*214\s*,\s*151/);
  // .panel.transition-duration includes the snippet's line-reveal
  // duration (deep-recall = 540ms). Duration list is comma-separated
  // — assert the 540ms value appears in it.
  expect(consumed!.panelTransition).toContain(`${deepRecall.feelCue.lineRevealDurationMs / 1000}s`);
  expect(consumed!.panelTransitionDelay).toContain(`${deepRecall.feelCue.lineRevealDelayMs / 1000}s`);
  // .line reveal transition — same reveal-duration + delay from the
  // same snippet, on a DIFFERENT element. Two consumers, one source.
  expect(consumed!.lineTransitionDuration).toContain(`${deepRecall.feelCue.lineRevealDurationMs / 1000}s`);
  expect(consumed!.lineTransitionDelay).toContain(`${deepRecall.feelCue.lineRevealDelayMs / 1000}s`);
  // body::after opacity IS --io-recognition-vignette-alpha (deep-recall
  // = 0.18). getComputedStyle returns opacity as a numeric string.
  expect(parseFloat(consumed!.vignetteOpacity)).toBeCloseTo(deepRecall.feelCue.vignetteAlpha, 3);
  // .hud transition-duration must contain --io-recognition-duration-ms
  // (deep-recall = 1040ms → "1.04s" in the transition-duration list).
  expect(consumed!.hudTransitionDuration).toContain(`${deepRecall.feelCue.durationMs / 1000}s`);
});
