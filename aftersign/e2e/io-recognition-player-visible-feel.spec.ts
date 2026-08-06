import { expect, test } from '@playwright/test';

/**
 * Player-visible feel contract for AFTERSIGN's first *returning* Io
 * recognition beat, driven through the SHIPPED window harness
 * (`AftersignWindowGameHarness` in
 * apps/web/src/aftersign/harness/bootWindowGame.ts).
 *
 * The journey this spec locks in:
 *   1. First contact with Io — no recall envelope fires (nothing to
 *      remember yet). `getRecallTrigger()` stays null.
 *   2. Return meet with Io — recognition transitions
 *      `!prev.recognizes && next.recognizes`, so the harness stamps
 *      a `{ npcId:'io', firedAtMs }` trigger. This is the beat.
 *   3. Renderer samples `recallFeel({ elapsedMs })` across the
 *      envelope. The frame shape and numeric bounds come from
 *      `MEMORY_RECALL_FEEL` in apps/web/src/aftersign/memoryRecallFeel.ts —
 *      durationMs 760, phases dormant → recognize (0-220ms) →
 *      settle (220-540ms) → held (540-760ms), peak yaw 1.6°, peak
 *      caption lift 14 px, haptic 12 ms fired on the first frame.
 *
 * The spec runs on the served page so a webServer / bundling
 * regression that fails to expose `window.__game` is caught the same
 * way a runtime feel regression would be.
 */

type RecallFrame = {
  phase: 'dormant' | 'recognize' | 'settle' | 'held';
  elapsedMs: number;
  progress: number;
  captionOpacity: number;
  captionLiftPx: number;
  haloOpacity: number;
  haloScale: number;
  cameraYawDeg: number;
  bloomGain: number;
  audioGain: number;
  hapticMs: number;
};

type BeatResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      firstContactTrigger: unknown;
      returnTrigger: { npcId: string; firedAtMs: number } | null;
      frames: {
        atZero: RecallFrame | null;
        atRecognizePeak: RecallFrame | null;
        atSettle: RecallFrame | null;
        atHeldEnd: RecallFrame | null;
      };
      ioRecognizes: boolean;
    };

test('returning Io recognition beat exposes bounded feel envelope on the served page', async ({ page }) => {
  await page.goto('/aftersign/');

  const result: BeatResult = await page.evaluate(async () => {
    const game = (window as unknown as { __game?: any }).__game;

    if (!game) {
      return { ok: false, reason: 'window.__game is not exposed on the served AFTERSIGN page' };
    }

    for (const method of ['meetNpc', 'getRecallTrigger', 'recallFeel', 'getStoryState'] as const) {
      if (typeof game[method] !== 'function') {
        return { ok: false, reason: `window.__game.${method} is not a function` };
      }
    }

    // Step 1: first contact with Io. No recall envelope should arm.
    game.meetNpc('io');
    const firstContactTrigger = game.getRecallTrigger();

    // Step 2: return meet. This is the transition that arms the
    // recall trigger — the beat we're locking in.
    game.meetNpc('io');
    const returnTrigger = game.getRecallTrigger();

    // Step 3: sample the envelope at four semantically meaningful
    // points inside the 760ms duration.
    const atZero = game.recallFeel({ elapsedMs: 0 });
    const atRecognizePeak = game.recallFeel({ elapsedMs: 220 }); // end of `recognize` phase
    const atSettle = game.recallFeel({ elapsedMs: 380 }); // middle of `settle`
    const atHeldEnd = game.recallFeel({ elapsedMs: 760 }); // tail of `held`

    // `getStoryState()` returns `AftersignStoryStateSnapshot` shaped as
    // `{ story, state }`, with per-NPC memory living at
    // `state.npcs[i].memory.recognizesPlayer` (see
    // apps/web/src/aftersign/windowGameSurface.ts). Read the Io entry
    // out of that array — earlier drafts of this spec looked for
    // `story.io.recognizesPlayer` / `story.ioRecognizesPlayer`, neither
    // of which exists on the snapshot, so the assertion was silently
    // asserting `false` against `Boolean(undefined)`.
    const snapshot = game.getStoryState();
    const ioNpc = Array.isArray(snapshot?.state?.npcs)
      ? snapshot.state.npcs.find((npc: { id?: string }) => npc?.id === 'io')
      : null;
    const ioRecognizes = Boolean(ioNpc?.memory?.recognizesPlayer);

    return {
      ok: true,
      firstContactTrigger,
      returnTrigger,
      frames: { atZero, atRecognizePeak, atSettle, atHeldEnd },
      ioRecognizes,
    };
  });

  expect(result.ok, result.ok ? undefined : (result as { reason: string }).reason).toBe(true);
  if (!result.ok) return;

  // First contact must NOT arm a recall trigger — that's the
  // harness's "first meet has no memory yet" contract.
  expect(result.firstContactTrigger).toBeNull();

  // Return meet MUST arm an Io recall trigger with a numeric timestamp.
  expect(result.returnTrigger).not.toBeNull();
  expect(result.returnTrigger?.npcId).toBe('io');
  expect(typeof result.returnTrigger?.firedAtMs).toBe('number');
  expect(Number.isFinite(result.returnTrigger?.firedAtMs ?? NaN)).toBe(true);

  // Story state must reflect that Io now recognizes the player after
  // the return beat — the feel envelope isn't meaningful without it.
  expect(result.ioRecognizes).toBe(true);

  const { atZero, atRecognizePeak, atSettle, atHeldEnd } = result.frames;
  expect(atZero).not.toBeNull();
  expect(atRecognizePeak).not.toBeNull();
  expect(atSettle).not.toBeNull();
  expect(atHeldEnd).not.toBeNull();

  // --- Feel numbers ------------------------------------------------

  // Dormant frame at t=0: nothing has moved yet.
  expect(atZero!.phase).toBe('dormant');
  expect(atZero!.captionLiftPx).toBe(0);
  expect(atZero!.cameraYawDeg).toBe(0);
  expect(atZero!.haloScale).toBe(1);

  // End of the recognize sub-phase (220ms boundary). The harness
  // treats `elapsedMs > recognizeEnd` as `settle`, so at exactly 220
  // we should still be in `recognize`. Peak entrance energy lives here.
  expect(atRecognizePeak!.phase).toBe('recognize');
  expect(atRecognizePeak!.captionOpacity).toBeGreaterThan(0.9);
  expect(atRecognizePeak!.hapticMs).toBe(0); // haptic only fires on the very first frame

  // Mid-settle: caption lift is real but bounded by the constant.
  expect(atSettle!.phase).toBe('settle');
  expect(atSettle!.captionLiftPx).toBeGreaterThan(0);
  expect(atSettle!.captionLiftPx).toBeLessThanOrEqual(14); // MEMORY_RECALL_FEEL.captionLiftPx
  expect(Math.abs(atSettle!.cameraYawDeg)).toBeLessThanOrEqual(1.6); // MEMORY_RECALL_FEEL.cameraYawDeg peak
  expect(atSettle!.haloScale).toBeGreaterThan(1);
  expect(atSettle!.haloScale).toBeLessThanOrEqual(1.18); // MEMORY_RECALL_FEEL.haloScalePeak

  // Tail of held: the beat is winding down; caption should be fading.
  expect(atHeldEnd!.phase).toBe('held');
  expect(atHeldEnd!.captionOpacity).toBeLessThanOrEqual(0.05);
  expect(atHeldEnd!.haloOpacity).toBeLessThanOrEqual(0.05);

  // First-frame haptic: 12ms tap, fires only inside the first render tick.
  const firstFrame = await page.evaluate(() => {
    const game = (window as unknown as { __game?: any }).__game;
    return game.recallFeel({ elapsedMs: 8 });
  });
  expect(firstFrame.hapticMs).toBe(12); // MEMORY_RECALL_FEEL.hapticMs

  // Reduced-motion contract: yaw and lift trimmed, haptic suppressed.
  const reducedMotionFrame = await page.evaluate(() => {
    const game = (window as unknown as { __game?: any }).__game;
    return game.recallFeel({ elapsedMs: 8, reducedMotion: true });
  });
  expect(reducedMotionFrame.hapticMs).toBe(0);
  expect(Math.abs(reducedMotionFrame.cameraYawDeg)).toBeLessThan(Math.abs(firstFrame.cameraYawDeg) + 1e-6);
});
