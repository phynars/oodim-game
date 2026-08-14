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
