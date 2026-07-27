export type AftersignKioskSceneFeel = {
  readonly label: "kiosk-scene-ready";
  readonly camera: {
    readonly settleMs: number;
    readonly startOffsetYPx: number;
    readonly startPushInZPx: number;
    readonly easing: "cubic-bezier(.2,.8,.2,1)";
  };
  readonly recognition: {
    readonly ledWakeMs: number;
    readonly scanlineTravelPx: number;
    readonly scanlineFrames: number;
    readonly faceplateGlowPx: number;
    readonly easing: "ease-out-cubic";
  };
  readonly audio: {
    readonly cue: "kiosk-ready-chime";
    readonly chimeDelayMs: number;
    readonly humDuckDb: number;
  };
};

export type AftersignKioskSceneEnvelope = {
  readonly label: AftersignKioskSceneFeel["label"];
  readonly elapsedMs: number;
  readonly cameraYOffsetPx: number;
  readonly cameraPushInZPx: number;
  readonly scanlineYPx: number;
  readonly ledGlowAlpha: number;
  readonly faceplateGlowPx: number;
  readonly humDuckDb: number;
  readonly audioCue: AftersignKioskSceneFeel["audio"]["cue"] | null;
};

export const AFTERSIGN_KIOSK_SCENE_FEEL: AftersignKioskSceneFeel = {
  label: "kiosk-scene-ready",
  camera: {
    settleMs: 420,
    startOffsetYPx: 18,
    startPushInZPx: -24,
    easing: "cubic-bezier(.2,.8,.2,1)",
  },
  recognition: {
    ledWakeMs: 180,
    scanlineTravelPx: 42,
    scanlineFrames: 18,
    faceplateGlowPx: 6,
    easing: "ease-out-cubic",
  },
  audio: {
    cue: "kiosk-ready-chime",
    chimeDelayMs: 120,
    humDuckDb: -4,
  },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

const assertFiniteElapsed = (elapsedMs: number) => {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error("Cannot sample Aftersign kiosk scene feel: elapsedMs must be a non-negative finite number");
  }
};

export const sampleAftersignKioskSceneEnvelope = (
  elapsedMs: number,
  options: { readonly reducedMotion?: boolean } = {},
): AftersignKioskSceneEnvelope => {
  assertFiniteElapsed(elapsedMs);

  const { camera, recognition, audio, label } = AFTERSIGN_KIOSK_SCENE_FEEL;
  const cameraProgress = options.reducedMotion ? 1 : easeOutCubic(elapsedMs / camera.settleMs);
  const ledProgress = easeOutCubic(elapsedMs / recognition.ledWakeMs);
  const scanlineMs = (recognition.scanlineFrames / 60) * 1_000;
  const scanlineProgress = options.reducedMotion ? 1 : easeOutCubic(elapsedMs / scanlineMs);
  const humProgress = clamp01(elapsedMs / audio.chimeDelayMs);

  return {
    label,
    elapsedMs,
    cameraYOffsetPx: camera.startOffsetYPx * (1 - cameraProgress),
    cameraPushInZPx: camera.startPushInZPx * (1 - cameraProgress),
    scanlineYPx: recognition.scanlineTravelPx * scanlineProgress,
    ledGlowAlpha: ledProgress,
    faceplateGlowPx: recognition.faceplateGlowPx * ledProgress,
    humDuckDb: audio.humDuckDb * (1 - humProgress),
    audioCue: elapsedMs >= audio.chimeDelayMs ? audio.cue : null,
  };
};
