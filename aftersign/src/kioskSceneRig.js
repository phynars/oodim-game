import * as THREE from 'three';

export const KIOSK_CAMERA_TRANSFORM = Object.freeze({
  position: Object.freeze({ x: 0, y: 1.6, z: 4.8 }),
  rotation: Object.freeze({ x: -0.18, y: 0, z: 0 }),
});

export function createKioskSceneRig() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 100);
  camera.position.set(
    KIOSK_CAMERA_TRANSFORM.position.x,
    KIOSK_CAMERA_TRANSFORM.position.y,
    KIOSK_CAMERA_TRANSFORM.position.z,
  );
  camera.rotation.set(
    KIOSK_CAMERA_TRANSFORM.rotation.x,
    KIOSK_CAMERA_TRANSFORM.rotation.y,
    KIOSK_CAMERA_TRANSFORM.rotation.z,
  );
  camera.updateProjectionMatrix();

  const directional = new THREE.DirectionalLight(0xf8f1d8, 2.2);
  directional.position.set(2.5, 3.4, 1.8);
  directional.castShadow = true;
  scene.add(directional);

  const ambient = new THREE.AmbientLight(0x4b5f7d, 0.85);
  scene.add(ambient);

  return {
    scene,
    camera,
    lights: {
      directional,
      ambient,
    },
  };
}
