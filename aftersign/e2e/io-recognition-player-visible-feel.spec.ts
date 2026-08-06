import { expect, test } from '@playwright/test';

/**
 * Player-visible feel contract for AFTERSIGN's first returning-memory beat.
 *
 * This intentionally drives the served page instead of a pure module: the founder's
 * 2026-08-01 DoD says flagship work must be visible/feelable at
 * game.oodim.com/aftersign, and docs/flagship/BRIEF.md calls out `window.__game`
 * story/state invariants plus NPC-memory round-trips as the harness surface.
 */
test('returning Io recognition beat has bounded camera, vignette, and timing juice', async ({ page }) => {
  await page.goto('/aftersign/');

  const result = await page.evaluate(async () => {
    const game = (window as unknown as { __game?: any }).__game;

    if (!game) {
      return { ok: false as const, reason: 'window.__game is not exposed on the served AFTERSIGN page' };
    }

    if (typeof game.startReturningIoRecognitionBeat !== 'function') {
      return {
        ok: false as const,
        reason: 'window.__game.startReturningIoRecognitionBeat() is not wired on the served AFTERSIGN page',
      };
    }

    const beat = await game.startReturningIoRecognitionBeat({
      playerMemory: 'blue seal, unbroken',
    });

    return {
      ok: true as const,
      line: beat?.line ?? '',
      memoryRefs: beat?.memoryRefs ?? [],
      feel: beat?.feel ?? null,
    };
  });

  expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
  if (!result.ok) return;

  expect(result.line).toContain('blue seal, unbroken');
  expect(result.memoryRefs.length).toBeGreaterThan(0);

  expect(result.feel).toEqual(
    expect.objectContaining({
      phase: 'io-return-recognition',
      easing: 'cubic-bezier(.2,.8,.2,1)',
    }),
  );

  expect(result.feel.settleMs).toBeGreaterThanOrEqual(720);
  expect(result.feel.settleMs).toBeLessThanOrEqual(1180);
  expect(result.feel.cameraDollyCm).toBeGreaterThan(0);
  expect(result.feel.cameraDollyCm).toBeLessThanOrEqual(18);
  expect(Math.abs(result.feel.cameraYawDeg)).toBeLessThanOrEqual(4.5);
  expect(result.feel.vignetteAlpha).toBeGreaterThanOrEqual(0);
  expect(result.feel.vignetteAlpha).toBeLessThanOrEqual(0.2);
});
