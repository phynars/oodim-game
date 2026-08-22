import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  resolveAftersignRememberingNpcDialogue,
  type AftersignRememberingNpcDialogue,
  type AftersignRememberingNpcId,
  type AftersignRememberingNpcRecognitionFeel,
  type AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

export type AftersignRememberingNpcRecognitionHandle = {
  layer: HTMLElement;
  remove: () => void;
};

export type PlayAftersignRememberingNpcRecognitionOptions = {
  target?: HTMLElement;
  label?: string;
  reducedMotion?: boolean;
};

export type AftersignRememberingNpcInteraction = AftersignRememberingNpcDialogue;

const REMEMBERING_NPC_RECOGNITION_CLASS =
  "aftersign-remembering-npc-recognition";
const REMEMBERING_NPC_RECOGNITION_CLEANUP_BUFFER_MS = 80;

function recognitionLabel(
  dialogue: AftersignRememberingNpcDialogue,
  label?: string,
): string {
  if (label) return label;
  const npcName = dialogue.npc === "io" ? "Io" : "Orra";
  return `${npcName} remembers you`;
}

function setRecognitionFeelVariables(
  layer: HTMLElement,
  feel: AftersignRememberingNpcRecognitionFeel,
  reducedMotion: boolean,
): void {
  const portraitPushInPx = reducedMotion ? 0 : feel.portraitPushInPx;
  const recognitionRingScale = reducedMotion ? 1 : feel.recognitionRingScale;
  const subtitlePopDistancePx = reducedMotion ? 0 : feel.subtitlePopDistancePx;

  layer.style.setProperty("--aftersign-recognition-pre-line-hold", `${feel.preLineHoldMs}ms`);
  layer.style.setProperty("--aftersign-recognition-portrait-push", `${portraitPushInPx}px`);
  layer.style.setProperty("--aftersign-recognition-portrait-push-ms", `${feel.portraitPushInMs}ms`);
  layer.style.setProperty("--aftersign-recognition-portrait-easing", feel.portraitPushInEasing);
  layer.style.setProperty("--aftersign-recognition-ring-delay", `${feel.recognitionRingDelayMs}ms`);
  layer.style.setProperty("--aftersign-recognition-ring-duration", `${feel.recognitionRingDurationMs}ms`);
  layer.style.setProperty("--aftersign-recognition-ring-scale", String(recognitionRingScale));
  layer.style.setProperty("--aftersign-recognition-ring-opacity", String(feel.recognitionRingOpacity));
  layer.style.setProperty("--aftersign-recognition-subtitle-delay", `${feel.subtitlePopDelayMs}ms`);
  layer.style.setProperty("--aftersign-recognition-subtitle-distance", `${subtitlePopDistancePx}px`);
  layer.style.setProperty("--aftersign-recognition-subtitle-ms", `${feel.subtitlePopMs}ms`);
  layer.style.setProperty("--aftersign-recognition-subtitle-easing", feel.subtitlePopEasing);

  layer.dataset.recognitionPreLineHoldMs = String(feel.preLineHoldMs);
  layer.dataset.recognitionPortraitPushInPx = String(portraitPushInPx);
  layer.dataset.recognitionPortraitPushInMs = String(feel.portraitPushInMs);
  layer.dataset.recognitionPortraitPushInEasing = feel.portraitPushInEasing;
  layer.dataset.recognitionRingDelayMs = String(feel.recognitionRingDelayMs);
  layer.dataset.recognitionRingDurationMs = String(feel.recognitionRingDurationMs);
  layer.dataset.recognitionRingScale = String(recognitionRingScale);
  layer.dataset.recognitionRingOpacity = String(feel.recognitionRingOpacity);
  layer.dataset.recognitionSubtitlePopDelayMs = String(feel.subtitlePopDelayMs);
  layer.dataset.recognitionSubtitlePopDistancePx = String(subtitlePopDistancePx);
  layer.dataset.recognitionSubtitlePopMs = String(feel.subtitlePopMs);
  layer.dataset.recognitionSubtitlePopEasing = feel.subtitlePopEasing;
  layer.dataset.recognitionAudioCueDelayMs = reducedMotion
    ? "0"
    : String(feel.audioCueDelayMs);
  if (reducedMotion) {
    layer.dataset.recognitionReducedMotion = "true";
  }
}

export function playAftersignRememberingNpcRecognitionFeel(
  dialogue: AftersignRememberingNpcDialogue,
  options: PlayAftersignRememberingNpcRecognitionOptions = {},
): AftersignRememberingNpcRecognitionHandle | null {
  const { target = document.body, label, reducedMotion = false } = options;
  const feel = dialogue.recognitionFeel;

  if (!feel) return null;

  const layer = document.createElement("div");
  layer.className = REMEMBERING_NPC_RECOGNITION_CLASS;
  layer.setAttribute("role", "status");
  layer.setAttribute("aria-live", "polite");
  layer.dataset.npc = dialogue.npc;
  layer.dataset.recognizesPlayer = String(dialogue.recognizesPlayer);
  layer.textContent = recognitionLabel(dialogue, label);
  setRecognitionFeelVariables(layer, feel, reducedMotion);

  target.appendChild(layer);

  const cleanupDelayMs = Math.max(
    feel.preLineHoldMs + feel.portraitPushInMs,
    feel.recognitionRingDelayMs + feel.recognitionRingDurationMs,
    feel.subtitlePopDelayMs + feel.subtitlePopMs,
    feel.audioCueDelayMs,
  ) + REMEMBERING_NPC_RECOGNITION_CLEANUP_BUFFER_MS;

  const cleanupTimer = window.setTimeout(() => {
    layer.remove();
  }, cleanupDelayMs);

  return {
    layer,
    remove: () => {
      window.clearTimeout(cleanupTimer);
      layer.remove();
    },
  };
}

export function resolveAndPlayAftersignRememberingNpcInteraction(
  state: AftersignVerticalSliceState,
  npc: AftersignRememberingNpcId,
  options: PlayAftersignRememberingNpcRecognitionOptions = {},
): AftersignRememberingNpcInteraction {
  const dialogue = resolveAftersignRememberingNpcDialogue(state, npc);
  playAftersignRememberingNpcRecognitionFeel(dialogue, options);
  return dialogue;
}

export function getAftersignRememberingNpcRecognitionFeel(): AftersignRememberingNpcRecognitionFeel {
  return AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;
}
