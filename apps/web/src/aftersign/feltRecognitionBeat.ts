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
} as const;

export type AftersignFeltRecognitionBeat = typeof AFTERSIGN_FELT_RECOGNITION_BEAT;

export interface AftersignRecognitionMemoryLine {
  playerName: string;
  rememberedAction: string;
  npcName?: string;
}

export interface AftersignRecognitionCue {
  line: string;
  ariaLabel: string;
  feel: AftersignFeltRecognitionBeat;
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

  return {
    line: `${npcName} remembers you, ${playerName}: ${rememberedAction}.`,
    ariaLabel: `${npcName} recognizes ${playerName} and recalls ${rememberedAction}.`,
    feel: AFTERSIGN_FELT_RECOGNITION_BEAT,
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
