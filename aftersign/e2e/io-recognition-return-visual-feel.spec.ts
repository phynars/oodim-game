import { expect, test } from '@playwright/test';

type RecognitionFeelSnapshot = {
  beat?: string;
  settledMs?: number;
  cameraDollyMeters?: number;
  cameraYawDegrees?: number;
  vignetteAlpha?: number;
  bloomIntensity?: number;
  memoryRefs?: string[];
};

type AftersignGameDebug = {
  recognition?: RecognitionFeelSnapshot;
  story?: {
    beat?: string;
    currentBeat?: string;
    lastLine?: string;
    memoryRefs?: string[];
  };
  lastNpcLine?: string;
  lastLine?: string;
  debug?: {
    recognition?: RecognitionFeelSnapshot;
    lastNpcLine?: string;
  };
};

const RETURNING_PLAYER_KEY = 'diego-io-return-feel-contract';
const RECOGNITION_MIN_MS = 720;
const RECOGNITION_MAX_MS = 1180;
const MAX_CAMERA_DOLLY_METERS = 0.18;
const MAX_CAMERA_YAW_DEGREES = 4.5;
const MAX_VIGNETTE_ALPHA = 0.2;
const MAX_BLOOM_INTENSITY = 0.2;

async function waitForRecognition(page: Parameters<typeof test>[0]['page']) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const game = (window as unknown as { __game?: AftersignGameDebug }).__game;
          return (
            game?.recognition?.beat ??
            game?.debug?.recognition?.beat ??
            game?.story?.beat ??
            game?.story?.currentBeat ??
            ''
          );
        }),
      { timeout: 5_000 },
    )
    .toBe('io-return-recognition');
}

test('returning Io recognition beat exposes readable visual feel numbers', async ({ page }) => {
  await page.goto(`/aftersign/?player=${RETURNING_PLAYER_KEY}&seed=io-return-feel`);

  await page.evaluate(() => {
    localStorage.setItem(
      'aftersign:memory:diego-io-return-feel-contract',
      JSON.stringify({
        playerKey: 'diego-io-return-feel-contract',
        sealedPackets: [
          {
            id: 'blue-seal-intact',
            npc: 'io',
            text: 'blue seal, unbroken',
            savedAt: '2026-08-01T11:13:00.000Z',
          },
        ],
        npcMemory: {
          io: {
            met: true,
            trust: 1,
            rememberedLines: ['blue seal, unbroken'],
          },
        },
      }),
    );
  });

  await page.reload();
  await waitForRecognition(page);

  const snapshot = await page.evaluate(() => {
    const game = (window as unknown as { __game?: AftersignGameDebug }).__game;
    const recognition = game?.recognition ?? game?.debug?.recognition ?? {};
    const line = game?.lastNpcLine ?? game?.debug?.lastNpcLine ?? game?.story?.lastLine ?? game?.lastLine ?? '';
    const memoryRefs = recognition.memoryRefs ?? game?.story?.memoryRefs ?? [];

    return {
      recognition,
      line,
      memoryRefs,
    };
  });

  expect(snapshot.line).toContain('blue seal, unbroken');
  expect(snapshot.memoryRefs.length).toBeGreaterThan(0);

  expect(snapshot.recognition.settledMs).toBeGreaterThanOrEqual(RECOGNITION_MIN_MS);
  expect(snapshot.recognition.settledMs).toBeLessThanOrEqual(RECOGNITION_MAX_MS);
  expect(snapshot.recognition.cameraDollyMeters).toBeLessThanOrEqual(MAX_CAMERA_DOLLY_METERS);
  expect(Math.abs(snapshot.recognition.cameraYawDegrees ?? 0)).toBeLessThanOrEqual(MAX_CAMERA_YAW_DEGREES);
  expect(snapshot.recognition.vignetteAlpha).toBeGreaterThanOrEqual(0);
  expect(snapshot.recognition.vignetteAlpha).toBeLessThanOrEqual(MAX_VIGNETTE_ALPHA);
  expect(snapshot.recognition.bloomIntensity).toBeGreaterThanOrEqual(0);
  expect(snapshot.recognition.bloomIntensity).toBeLessThanOrEqual(MAX_BLOOM_INTENSITY);
});
