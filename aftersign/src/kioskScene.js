import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export const createKioskScene = (canvas) => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07111d, 0.045);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  camera.position.set(0, 2.25, 7.6);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.55, 0.18);
  composer.addPass(bloomPass);

  const hemi = new THREE.HemisphereLight(0x8ccfff, 0x09111d, 1.4);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xc4f4ff, 2.2);
  key.position.set(-4, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const signLight = new THREE.PointLight(0x33ddff, 8, 9, 1.8);
  signLight.position.set(0, 2.15, -1.1);
  scene.add(signLight);

  const wetGround = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 18),
    new THREE.MeshStandardMaterial({ color: 0x07111a, roughness: 0.18, metalness: 0.2 })
  );
  wetGround.rotation.x = -Math.PI / 2;
  wetGround.receiveShadow = true;
  scene.add(wetGround);

  const playerMesh = new THREE.Group();
  const playerBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.74, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xf4dfb1, roughness: 0.48, metalness: 0.08 })
  );
  playerBody.position.y = 0.76;
  playerBody.castShadow = true;
  playerMesh.add(playerBody);
  const playerFacing = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x79e8ff, emissive: 0x17677b, emissiveIntensity: 0.7 })
  );
  playerFacing.position.set(0, 1.02, 0.18);
  playerMesh.add(playerFacing);
  scene.add(playerMesh);

  const kiosk = new THREE.Group();
  const kioskBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 2.45, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x102134, roughness: 0.42, metalness: 0.25 })
  );
  kioskBody.position.y = 1.23;
  kioskBody.castShadow = true;
  kiosk.add(kioskBody);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.66, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x67eaff, emissive: 0x25cfff, emissiveIntensity: 1.8, roughness: 0.08 })
  );
  screen.position.set(0, 1.65, 0.28);
  kiosk.add(screen);

  const slotMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x07111a, emissive: 0x0b6a82, emissiveIntensity: 0.7 })
  );
  slotMesh.position.set(0, 0.92, 0.3);
  kiosk.add(slotMesh);
  scene.add(kiosk);
  const kioskHitTargets = [kioskBody, screen, slotMesh];

  const io = new THREE.Group();
  const coat = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 1.08, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x1d2738, roughness: 0.64, metalness: 0.05 })
  );
  coat.position.y = 1.1;
  coat.castShadow = true;
  io.add(coat);

  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xd7b99c, roughness: 0.5 })
  );
  face.position.y = 1.92;
  face.castShadow = true;
  io.add(face);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x8af2ff, emissive: 0x5bdfff, emissiveIntensity: 1.1 })
  );
  visor.position.set(0, 1.95, 0.17);
  io.add(visor);
  io.position.set(-1.55, 0, 0.7);
  io.rotation.y = 0.35;
  scene.add(io);

  const makeTower = (x, z, height, color) => {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, height, 0.72),
      new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08 })
    );
    tower.position.set(x, height / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);

    const windowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.06, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffca75, emissive: 0xff9d2e, emissiveIntensity: 0.45 })
    );
    windowStrip.position.set(x, height * 0.72, z + 0.39);
    scene.add(windowStrip);
  };

  makeTower(-4.6, -3.8, 4.4, 0x0c1724);
  makeTower(3.8, -3.4, 5.8, 0x101b2a);
  makeTower(-3.1, -6.1, 7.1, 0x0a1420);
  makeTower(4.9, -6.4, 6.3, 0x0d1722);

  const rain = new THREE.Group();
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0x8edfff, transparent: true, opacity: 0.38 });
  for (let i = 0; i < 90; i += 1) {
    const x = THREE.MathUtils.randFloatSpread(13);
    const y = THREE.MathUtils.randFloat(1.5, 8.5);
    const z = THREE.MathUtils.randFloat(-8, 4);
    const points = [new THREE.Vector3(x, y, z), new THREE.Vector3(x - 0.08, y - 0.55, z)];
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), rainMaterial);
    rain.add(drop);
  }
  scene.add(rain);

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
  };

  return {
    scene,
    camera,
    raycaster,
    pointer,
    renderer,
    composer,
    bloomPass,
    signLight,
    playerMesh,
    kiosk,
    screen,
    slotMesh,
    io,
    rain,
    kioskHitTargets,
    resize,
  };
};
