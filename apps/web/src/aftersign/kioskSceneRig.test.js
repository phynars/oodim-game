import { describe, expect, it } from 'vitest';

import { createKioskSceneRig } from '../../../../aftersign/src/kioskSceneRig.js';

const EXPECTED_CAMERA_POSITION = { x: 0, y: 1.6, z: 4.8 };
const EXPECTED_CAMERA_ROTATION = { x: -0.18, y: 0, z: 0 };

describe('AFTERSIGN kiosk scene rig', () => {
  it('initializes the vertical-slice render context with fixed lighting and camera', () => {
    const rig = createKioskSceneRig();

    expect(rig).toMatchObject({
      scene: expect.any(Object),
      camera: expect.any(Object),
      lights: {
        directional: expect.any(Object),
        ambient: expect.any(Object),
      },
    });

    const sceneChildren = rig.scene.children ?? [];
    const directionalLights = sceneChildren.filter((child) => child?.type === 'DirectionalLight');
    const ambientLights = sceneChildren.filter((child) => child?.type === 'AmbientLight');

    expect(directionalLights).toHaveLength(1);
    expect(ambientLights).toHaveLength(1);
    expect(rig.lights.directional).toBe(directionalLights[0]);
    expect(rig.lights.ambient).toBe(ambientLights[0]);

    expect(rig.camera.type).toBe('PerspectiveCamera');
    expect(rig.camera.position.toArray()).toEqual([
      EXPECTED_CAMERA_POSITION.x,
      EXPECTED_CAMERA_POSITION.y,
      EXPECTED_CAMERA_POSITION.z,
    ]);
    expect(rig.camera.rotation.x).toBeCloseTo(EXPECTED_CAMERA_ROTATION.x, 5);
    expect(rig.camera.rotation.y).toBeCloseTo(EXPECTED_CAMERA_ROTATION.y, 5);
    expect(rig.camera.rotation.z).toBeCloseTo(EXPECTED_CAMERA_ROTATION.z, 5);
  });
});
