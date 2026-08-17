export const AFTERSIGN_FELT_RECOGNITION_BEAT = {
  durationMs: 940,
  nameRevealDelayMs: 120,
  eyeContactHoldMs: 260,
  memoryEchoDelayMs: 420,
  cameraPushPx: 18,
  shoulderLiftPx: -6,
  bloomScale: 1.08,
  shakePx: 2,
  shakeFrames: 6,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  audio: {
    whisperCue: "memory-whisper-a4",
    chimeCue: "recognition-chime-c6",
    chimeDelayMs: 160,
  },
  // RETURN VARIANT — additive sub-envelope for the "returning player" flavor
  // of the same felt-recognition beat. Same tempo owner as the block above;
  // when `isReturning` is set on the resolved cue, the layer picks up these
  // numbers as datasets alongside the base ones (the served renderer chooses
  // which subset to drive). Kept here (single contract) instead of forking a
  // parallel juice module — the beat is one beat, in two flavors.
  returnVariant: {
    anticipationMs: 48,
    cardLiftPx: 10,
    cameraNodDeg: 1.6,
    shakePx: 3,
    shakeMs: 90,
    bloomPulseMs: 180,
    chipPopPx: 8,
    chipPopScale: 1.08,
    easeOutBack: "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
    easeSettle: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const;

export type AftersignFeltRecognitionReturnVariant =
  typeof AFTERSIGN_FELT_RECOGNITION_BEAT.returnVariant;

/**
 * Reduced-motion projection of the return-variant numbers. Motion-heavy
 * fields collapse to 0 (lift / camera nod / shake / chip travel); tempo
 * fields (anticipation, bloom pulse) stay so the beat still reads.
 *
 * Kept as a pure function next to the contract so both the DOM layer and
 * any Playwright / renderer harness produce the same projection.
 */
export function projectReturnVariantForReducedMotion(
  variant: AftersignFeltRecognitionReturnVariant = AFTERSIGN_FELT_RECOGNITION_BEAT.returnVariant,
): AftersignFeltRecognitionReturnVariant {
  return {
    anticipationMs: variant.anticipationMs,
    cardLiftPx: 0,
    cameraNodDeg: 0,
    shakePx: 0,
    shakeMs: 0,
    bloomPulseMs: Math.min(variant.bloomPulseMs, 120),
    chipPopPx: 0,
    chipPopScale: 1,
    easeOutBack: variant.easeSettle,
    easeSettle: variant.easeSettle,
  } as AftersignFeltRecognitionReturnVariant;
}

export type AftersignFeltRecognitionBeat = typeof AFTERSIGN_FELT_RECOGNITION_BEAT;

export interface AftersignRecognitionMemoryLine {
  playerName: string;
  rememberedAction: string;
  npcName?: string;
  /** Mark this recognition as the RETURNING-player flavor of the beat. */
  isReturning?: boolean;
}

export interface AftersignRecognitionCue {
  line: string;
  ariaLabel: string;
  feel: AftersignFeltRecognitionBeat;
  /** True when this cue represents the returning-player flavor. */
  isReturning: boolean;
}

function cleanSegment(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function resolveAftersignFeltRecognitionCue(
  memory: AftersignRecognitionMemoryLine,
): AftersignRecognitionCue {
  const playerName = cleanSegment(memory.playerName) || "traveler";
  const rememberedAction =
    cleanSegment(memory.rememberedAction) || "what you carried through the static";
  const npcName = cleanSegment(memory.npcName ?? "Mara");
  const isReturning = memory.isReturning === true;

  const line = isReturning
    ? `${npcName} remembers you again, ${playerName}: ${rememberedAction}.`
    : `${npcName} remembers you, ${playerName}: ${rememberedAction}.`;
  const ariaLabel = isReturning
    ? `${npcName} recognizes ${playerName} returning and recalls ${rememberedAction}.`
    : `${npcName} recognizes ${playerName} and recalls ${rememberedAction}.`;

  return {
    line,
    ariaLabel,
    feel: AFTERSIGN_FELT_RECOGNITION_BEAT,
    isReturning,
  };
}

export function createAftersignFeltRecognitionLayer(
  cue: AftersignRecognitionCue,
  documentRef: Pick<Document, "createElement"> = document,
): HTMLElement {
  const layer = documentRef.createElement("div");
  layer.className = "aftersign-felt-recognition";
  layer.setAttribute("role", "status");
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-label", cue.ariaLabel);
  layer.dataset.durationMs = String(cue.feel.durationMs);
  layer.dataset.nameRevealDelayMs = String(cue.feel.nameRevealDelayMs);
  layer.dataset.eyeContactHoldMs = String(cue.feel.eyeContactHoldMs);
  layer.dataset.memoryEchoDelayMs = String(cue.feel.memoryEchoDelayMs);
  layer.dataset.cameraPushPx = String(cue.feel.cameraPushPx);
  layer.dataset.shoulderLiftPx = String(cue.feel.shoulderLiftPx);
  layer.dataset.bloomScale = String(cue.feel.bloomScale);
  layer.dataset.shakePx = String(cue.feel.shakePx);
  layer.dataset.shakeFrames = String(cue.feel.shakeFrames);
  layer.dataset.easing = cue.feel.easing;
  layer.dataset.whisperCue = cue.feel.audio.whisperCue;
  layer.dataset.chimeCue = cue.feel.audio.chimeCue;
  layer.dataset.chimeDelayMs = String(cue.feel.audio.chimeDelayMs);
  if (cue.isReturning) {
    const rv = cue.feel.returnVariant;
    layer.dataset.isReturning = "true";
    layer.dataset.returnAnticipationMs = String(rv.anticipationMs);
    layer.dataset.returnCardLiftPx = String(rv.cardLiftPx);
    layer.dataset.returnCameraNodDeg = String(rv.cameraNodDeg);
    layer.dataset.returnShakePx = String(rv.shakePx);
    layer.dataset.returnShakeMs = String(rv.shakeMs);
    layer.dataset.returnBloomPulseMs = String(rv.bloomPulseMs);
    layer.dataset.returnChipPopPx = String(rv.chipPopPx);
    layer.dataset.returnChipPopScale = String(rv.chipPopScale);
    layer.dataset.returnEaseOutBack = rv.easeOutBack;
    layer.dataset.returnEaseSettle = rv.easeSettle;
  }
  layer.textContent = cue.line;
  return layer;
}

// -- Served-surface consumer wrapper ---------------------------------------
//
// The pieces above are the CONTRACT half (pure resolver + layer factory).
// The pieces below wire that contract into a shipped surface: a served page
// (or the vertical-slice window surface) can call
// `resolveAndPlayAftersignFeltRecognitionBeat(memory, { root })` on the
// NPC recognition beat and get:
//   - a `.aftersign-felt-recognition` element appended to `root` (default
//     `document.body`) — same "layer belongs on body" contract as
//     `aftersignConfirmFeel`;
//   - an auto-cleanup timer at `feel.durationMs + FELT_RECOGNITION_CLEANUP_TAIL_MS`
//     that removes the layer (matches the confirm-feel cleanup shape so the
//     served surface doesn't accumulate dead layers on repeated cues);
//   - a handle with `dispose()` so a scene-transition/interrupt can rip the
//     layer down early.
//
// Matches the lane precedent (`resolveAndPlayAftersignPacketConfirmInteraction`
// in verticalSlicePacketInteraction.ts) — resolver + player + one-shot combo.

export const FELT_RECOGNITION_CLEANUP_TAIL_MS = 80;

export type AftersignFeltRecognitionPlayOptions = {
  root?: HTMLElement;
  documentRef?: Document;
  reducedMotion?: boolean;
  now?: () => number;
  setTimeoutRef?: typeof setTimeout;
  clearTimeoutRef?: typeof clearTimeout;
};

export type AftersignFeltRecognitionHandle = {
  layer: HTMLElement;
  cue: AftersignRecognitionCue;
  feel: AftersignFeltRecognitionBeat;
  dispose: () => void;
};

/**
 * Plays a pre-resolved recognition cue on the served surface: appends the
 * layer to `root`, and schedules removal at `durationMs + tailMs`.
 *
 * `reducedMotion` zeroes the motion-heavy dataset values (camera push,
 * shoulder lift, shake) that a served renderer would drive CSS from; the
 * timing / audio metadata are preserved because the beat still needs to
 * READ (name reveal, memory echo) at the pinned tempo.
 */
export function playAftersignFeltRecognitionBeat(
  cue: AftersignRecognitionCue,
  options: AftersignFeltRecognitionPlayOptions = {},
): AftersignFeltRecognitionHandle {
  const documentRef = options.documentRef ?? document;
  const root = options.root ?? documentRef.body;
  const setTimeoutRef = options.setTimeoutRef ?? setTimeout;
  const clearTimeoutRef = options.clearTimeoutRef ?? clearTimeout;

  const layer = createAftersignFeltRecognitionLayer(cue, documentRef);

  if (options.reducedMotion) {
    layer.dataset.reducedMotion = "true";
    layer.dataset.cameraPushPx = "0";
    layer.dataset.shoulderLiftPx = "0";
    layer.dataset.shakePx = "0";
    layer.dataset.shakeFrames = "0";
    if (cue.isReturning) {
      const rv = projectReturnVariantForReducedMotion(cue.feel.returnVariant);
      layer.dataset.returnCardLiftPx = String(rv.cardLiftPx);
      layer.dataset.returnCameraNodDeg = String(rv.cameraNodDeg);
      layer.dataset.returnShakePx = String(rv.shakePx);
      layer.dataset.returnShakeMs = String(rv.shakeMs);
      layer.dataset.returnBloomPulseMs = String(rv.bloomPulseMs);
      layer.dataset.returnChipPopPx = String(rv.chipPopPx);
      layer.dataset.returnChipPopScale = String(rv.chipPopScale);
      layer.dataset.returnEaseOutBack = rv.easeOutBack;
      layer.dataset.returnEaseSettle = rv.easeSettle;
    }
  }

  root.appendChild(layer);

  let disposed = false;
  const timer = setTimeoutRef(() => {
    if (disposed) return;
    disposed = true;
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  }, cue.feel.durationMs + FELT_RECOGNITION_CLEANUP_TAIL_MS);

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
 * One-shot: resolve a recognition cue from stored memory AND mount it on
 * the served surface. This is the entry point a served page's NPC
 * recognition beat should call — it's the sibling of
 * `resolveAndPlayAftersignPacketConfirmInteraction` for the felt-recognition
 * lane.
 */
export function resolveAndPlayAftersignFeltRecognitionBeat(
  memory: AftersignRecognitionMemoryLine,
  options: AftersignFeltRecognitionPlayOptions = {},
): AftersignFeltRecognitionHandle {
  const cue = resolveAftersignFeltRecognitionCue(memory);
  return playAftersignFeltRecognitionBeat(cue, options);
}
