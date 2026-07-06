import { expect, test } from '@playwright/test';

type CameraFeelFrame = {
  timeMs: number;
  positionX: number;
  rotationZDeg: number;
};

type AftersignSnapshot = {
  interaction?: {
    confirmCount?: number;
    cameraFeel?: {
      frames?: CameraFeelFrame[];
      maxFramePositionDelta?: number;
      maxFrameRotationDeltaDeg?: number;
    };
  };
};

declare global {
  interface Window {
    __game: {
      getSnapshot: () => AftersignSnapshot;
      deliverPacket: () => void;
      resetSliceSave: () => void;
    };
  }
}

const waitForCameraFeelFrames = async (page: import('@playwright/test').Page, minFrames: number) => {
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__game.getSnapshot().interaction?.cameraFeel?.frames?.length ?? 0),
      { timeout: 1_500 }
    )
    .toBeGreaterThanOrEqual(minFrames);
};

test.describe('AFTERSIGN camera feel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__game.resetSliceSave());
  });

  test('packet confirm camera kick is damped below one visible pixel per 60fps frame', async ({ page }) => {
    await page.evaluate(() => window.__game.deliverPacket());
    await waitForCameraFeelFrames(page, 12);

    const snapshot = await page.evaluate(() => window.__game.getSnapshot());
    const cameraFeel = snapshot.interaction?.cameraFeel;

    expect(snapshot.interaction?.confirmCount).toBe(1);
    expect(cameraFeel?.frames?.length).toBeGreaterThanOrEqual(12);
    expect(cameraFeel?.maxFramePositionDelta).toBeLessThanOrEqual(0.012);
    expect(cameraFeel?.maxFrameRotationDeltaDeg).toBeLessThanOrEqual(0.34);
  });
});
