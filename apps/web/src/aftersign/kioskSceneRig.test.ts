import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildKioskSceneCameraLightRig,
  KIOSK_SCENE_CAMERA_TRANSFORM,
} from "../../../../aftersign/src/kioskScene.js";

describe("AFTERSIGN kiosk camera/light rig contract", () => {
  it("keeps shipped camera framing and light contract", () => {
    const scene = new THREE.Scene();
    const { camera, ambientLight, directionalLight, sceneInitContract } =
      buildKioskSceneCameraLightRig(scene);

    expect(sceneInitContract.camera).toEqual({
      fov: KIOSK_SCENE_CAMERA_TRANSFORM.fov,
      near: KIOSK_SCENE_CAMERA_TRANSFORM.near,
      far: KIOSK_SCENE_CAMERA_TRANSFORM.far,
      position: {
        x: KIOSK_SCENE_CAMERA_TRANSFORM.position.x,
        y: KIOSK_SCENE_CAMERA_TRANSFORM.position.y,
        z: KIOSK_SCENE_CAMERA_TRANSFORM.position.z,
      },
    });

    expect(camera.fov).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.fov);
    expect(camera.near).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.near);
    expect(camera.far).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.far);
    expect(camera.position.x).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.position.x);
    expect(camera.position.y).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.position.y);
    expect(camera.position.z).toBe(KIOSK_SCENE_CAMERA_TRANSFORM.position.z);

    expect(sceneInitContract.lights).toEqual({ ambient: 1, directional: 1 });
    expect(ambientLight.type).toBe("AmbientLight");
    expect(directionalLight.type).toBe("DirectionalLight");
    expect(directionalLight.castShadow).toBe(true);
  });
});
