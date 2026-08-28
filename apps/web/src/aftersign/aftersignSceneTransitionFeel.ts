// AFTERSIGN — scene-transition juice, three-phase envelope.
//
// The transition juice for the flagship's between-scene beats (the
// kiosk → io-return arrival, the io-return → orra-return pivot, and
// any similarly-shaped route commit). Kiosk-side the beat renders as
// three ordered feel phases:
//
//   recognition-settle   → the NPC's face steadies, camera drifts a
//                          few px in, low tone (G3, 196 Hz) settles.
//   job-offer-rise       → the offer card lifts, camera drifts and
//                          rolls a hair, mid tone (D4, 294 Hz) rises.
//   route-commit         → the world commits to the next scene,
//                          camera settles back, high tone (G4, 392 Hz)
//                          resolves the arpeggio.
//
// SPLIT (matches `feltRecognitionBeat.ts` / `aftersignConfirmFeel.ts`):
//   1. `AFTERSIGN_SCENE_TRANSITION_FEEL` — the pure contract. Camera
//      drift px / roll deg / vignette alpha / bloom alpha / audio
//      coupling. Locked by `aftersignSceneTransitionFeel.contract.test.ts`.
//   2. `resolveAftersignSceneTransitionCue(prev, next)` — pure
//      resolver that maps a scene-change on
//      `AftersignVerticalSliceState.scene` to the cue with per-phase
//      dataset payloads.
//   3. `playAftersignSceneTransition(cue, options)` — DOM player.
//      Appends `.aftersign-scene-transition` to `root` (default
//      `document.body`), exposes every feel number via `dataset`
//      entries so a served renderer can drive CSS/audio from real,
//      contract-backed values. Auto-cleans at
//      `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS`.
//   4. `resolveAndPlayAftersignSceneTransition(prev, next, options)` —
//      one-shot: the entry point a served flagship page's scene-change
//      hook calls when the runtime state's `scene` field flips.
//
// The consumer test (`aftersignSceneTransitionFeel.consumer.test.ts`)
// mounts the layer in jsdom and asserts the dataset carries the exact
// spec numbers — that's what proves this isn't a spec-with-no-consumer.

import type {
  AftersignSceneId,
  AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

export type AftersignSceneTransitionPhaseId =
  | "recognition-settle"
  | "job-offer-rise"
  | "route-commit";

export interface AftersignSceneTransitionFeelPhase {
  readonly id: AftersignSceneTransitionPhaseId;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly cameraDriftPx: number;
  readonly cameraRollDeg: number;
  readonly vignetteAlpha: number;
  readonly bloomPulseAlpha: number;
  readonly easing: "cubic-bezier(0.16, 1, 0.3, 1)" | "cubic-bezier(0.2, 0.8, 0.2, 1)";
}

export interface AftersignSceneTransitionFeel {
  readonly totalDurationMs: number;
  readonly reducedMotionDurationMs: number;
  readonly phases: readonly AftersignSceneTransitionFeelPhase[];
  readonly audioCoupling: {
    readonly recognitionSettleHz: number;
    readonly jobOfferRiseHz: number;
    readonly routeCommitHz: number;
    readonly gainDb: number;
  };
  readonly acceptance: {
    readonly maxTotalDurationMs: number;
    readonly minCameraDriftPx: number;
    readonly maxCameraRollDeg: number;
    readonly reducedMotionMaxDurationMs: number;
  };
}

export const AFTERSIGN_SCENE_TRANSITION_FEEL: AftersignSceneTransitionFeel = {
  totalDurationMs: 540,
  reducedMotionDurationMs: 140,
  phases: [
    {
      id: "recognition-settle",
      durationMs: 180,
      delayMs: 0,
      cameraDriftPx: 4,
      cameraRollDeg: -0.35,
      vignetteAlpha: 0.1,
      bloomPulseAlpha: 0.16,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
    {
      id: "job-offer-rise",
      durationMs: 240,
      delayMs: 120,
      cameraDriftPx: 9,
      cameraRollDeg: 0.5,
      vignetteAlpha: 0.18,
      bloomPulseAlpha: 0.26,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
    {
      id: "route-commit",
      durationMs: 180,
      delayMs: 360,
      cameraDriftPx: 6,
      cameraRollDeg: 0.2,
      vignetteAlpha: 0.08,
      bloomPulseAlpha: 0.2,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
  ],
  audioCoupling: {
    recognitionSettleHz: 196,
    jobOfferRiseHz: 294,
    routeCommitHz: 392,
    gainDb: -18,
  },
  acceptance: {
    maxTotalDurationMs: 600,
    minCameraDriftPx: 8,
    maxCameraRollDeg: 0.75,
    reducedMotionMaxDurationMs: 160,
  },
};

export function getAftersignSceneTransitionPhase(
  phase: AftersignSceneTransitionPhaseId,
): AftersignSceneTransitionFeelPhase {
  const match = AFTERSIGN_SCENE_TRANSITION_FEEL.phases.find(
    (candidate) => candidate.id === phase,
  );

  if (!match) {
    throw new Error(`Unknown AFTERSIGN scene transition phase: ${phase}`);
  }

  return match;
}

// ---------------------------------------------------------------------------
// Resolver — maps a scene change on the vertical-slice state to a cue.
// ---------------------------------------------------------------------------

export interface AftersignSceneTransitionCue {
  readonly from: AftersignSceneId;
  readonly to: AftersignSceneId;
  readonly ariaLabel: string;
  readonly feel: AftersignSceneTransitionFeel;
}

function humanScene(scene: AftersignSceneId): string {
  switch (scene) {
    case "kiosk":
      return "the kiosk";
    case "io-return":
      return "Io's session";
    case "orra-return":
      return "Saint Orra's altar";
  }
}

/**
 * Pure resolver: read the vertical-slice `scene` field on both sides
 * of a state change, return the cue that describes the transition.
 * Returns `null` when the scene didn't change (the transition is a
 * no-op) — callers can early-out without mounting a DOM layer.
 */
export function resolveAftersignSceneTransitionCue(
  previous: Pick<AftersignVerticalSliceState, "scene">,
  next: Pick<AftersignVerticalSliceState, "scene">,
): AftersignSceneTransitionCue | null {
  if (previous.scene === next.scene) return null;

  return {
    from: previous.scene,
    to: next.scene,
    ariaLabel: `Scene transitions from ${humanScene(previous.scene)} to ${humanScene(next.scene)}.`,
    feel: AFTERSIGN_SCENE_TRANSITION_FEEL,
  };
}

// ---------------------------------------------------------------------------
// DOM player — mounts a `.aftersign-scene-transition` layer on the served
// surface, exposing every feel number via `dataset` entries so a rendered
// camera/audio/vignette component can drive its animation from the same
// contract the test locks. Same shape as `playAftersignFeltRecognitionBeat`.
// ---------------------------------------------------------------------------

export const SCENE_TRANSITION_CLEANUP_TAIL_MS = 80;

export type AftersignSceneTransitionPlayOptions = {
  root?: HTMLElement;
  documentRef?: Document;
  reducedMotion?: boolean;
  setTimeoutRef?: typeof setTimeout;
  clearTimeoutRef?: typeof clearTimeout;
};

export type AftersignSceneTransitionHandle = {
  layer: HTMLElement;
  cue: AftersignSceneTransitionCue;
  feel: AftersignSceneTransitionFeel;
  dispose: () => void;
};

function writePhaseDataset(
  layer: HTMLElement,
  phase: AftersignSceneTransitionFeelPhase,
  reducedMotion: boolean,
): void {
  const prefix = `phase${phase.id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
  layer.dataset[`${prefix}DurationMs`] = String(phase.durationMs);
  layer.dataset[`${prefix}DelayMs`] = String(phase.delayMs);
  layer.dataset[`${prefix}CameraDriftPx`] = String(
    reducedMotion ? 0 : phase.cameraDriftPx,
  );
  layer.dataset[`${prefix}CameraRollDeg`] = String(
    reducedMotion ? 0 : phase.cameraRollDeg,
  );
  layer.dataset[`${prefix}VignetteAlpha`] = String(phase.vignetteAlpha);
  layer.dataset[`${prefix}BloomPulseAlpha`] = String(phase.bloomPulseAlpha);
  layer.dataset[`${prefix}Easing`] = phase.easing;
}

export function createAftersignSceneTransitionLayer(
  cue: AftersignSceneTransitionCue,
  documentRef: Pick<Document, "createElement"> = document,
  reducedMotion = false,
): HTMLElement {
  const layer = documentRef.createElement("div");
  layer.className = "aftersign-scene-transition";
  layer.setAttribute("role", "presentation");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.ariaLabel = cue.ariaLabel;
  layer.dataset.fromScene = cue.from;
  layer.dataset.toScene = cue.to;
  layer.dataset.totalDurationMs = String(
    reducedMotion ? cue.feel.reducedMotionDurationMs : cue.feel.totalDurationMs,
  );
  layer.dataset.reducedMotion = reducedMotion ? "true" : "false";

  layer.dataset.audioRecognitionSettleHz = String(
    cue.feel.audioCoupling.recognitionSettleHz,
  );
  layer.dataset.audioJobOfferRiseHz = String(
    cue.feel.audioCoupling.jobOfferRiseHz,
  );
  layer.dataset.audioRouteCommitHz = String(
    cue.feel.audioCoupling.routeCommitHz,
  );
  layer.dataset.audioGainDb = String(cue.feel.audioCoupling.gainDb);

  for (const phase of cue.feel.phases) {
    writePhaseDataset(layer, phase, reducedMotion);
  }

  return layer;
}

export function playAftersignSceneTransition(
  cue: AftersignSceneTransitionCue,
  options: AftersignSceneTransitionPlayOptions = {},
): AftersignSceneTransitionHandle {
  const documentRef = options.documentRef ?? document;
  const root = options.root ?? documentRef.body;
  const setTimeoutRef = options.setTimeoutRef ?? setTimeout;
  const clearTimeoutRef = options.clearTimeoutRef ?? clearTimeout;
  const reducedMotion = options.reducedMotion === true;

  const layer = createAftersignSceneTransitionLayer(
    cue,
    documentRef,
    reducedMotion,
  );
  root.appendChild(layer);

  const cleanupMs =
    (reducedMotion
      ? cue.feel.reducedMotionDurationMs
      : cue.feel.totalDurationMs) + SCENE_TRANSITION_CLEANUP_TAIL_MS;

  let disposed = false;
  const timer = setTimeoutRef(() => {
    if (disposed) return;
    disposed = true;
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  }, cleanupMs);

  return {
    layer,
    cue,
    feel: cue.feel,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeoutRef(timer);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    },
  };
}

/**
 * One-shot: resolve a scene-transition cue from a state change AND mount
 * it on the served surface. Returns `null` when the scene didn't change
 * (so the flagship's state-diff hook can call this unconditionally on
 * every commit — same shape as `resolveAndPlayAftersignFeltRecognitionBeat`).
 */
export function resolveAndPlayAftersignSceneTransition(
  previous: Pick<AftersignVerticalSliceState, "scene">,
  next: Pick<AftersignVerticalSliceState, "scene">,
  options: AftersignSceneTransitionPlayOptions = {},
): AftersignSceneTransitionHandle | null {
  const cue = resolveAftersignSceneTransitionCue(previous, next);
  if (!cue) return null;
  return playAftersignSceneTransition(cue, options);
}
