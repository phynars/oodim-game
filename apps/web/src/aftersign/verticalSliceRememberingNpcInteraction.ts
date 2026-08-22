// Runnable side-effect for the remembering-NPC recognition beat.
//
// PURPOSE — the pure resolver (`resolveAftersignRememberingNpcDialogue`
// in verticalSliceRuntimeState.ts) already stamps the FEEL row
// (`recognitionFeel`) onto the returned dialogue when
// `recognizesPlayer === true`. That's the DATA. This module is the
// runnable side-effect that turns that data into a live DOM layer the
// scene renderer (and jsdom consumer tests) can actually observe — the
// portrait-push-in distance, the recognition ring, the subtitle pop,
// and the audio-cue delay are all stamped onto CSS custom properties
// and dataset attributes on a single `.aftersign-remembering-npc-
// recognition` layer, then torn down after the beat's max envelope
// duration + an 80 ms cleanup buffer.
//
// WIRING — called from `harness/bootWindowGame.ts::
// getRememberingNpcDialogue` as a side-effect of the same hook the
// shipped surface (`bootAftersignWindowGame` on `window.__game`) and
// the vitest consumer specs both use. The pure resolver stays a pure
// function; the DOM effect lives here so a worker / SSR import of the
// resolver doesn't drag a `document.createElement` call along.

import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  type AftersignRememberingNpcDialogue,
  type AftersignRememberingNpcRecognitionFeel,
} from "./verticalSliceRuntimeState";

export type AftersignRememberingNpcRecognitionHandle = {
  layer: HTMLElement;
  remove: () => void;
};

export type PlayAftersignRememberingNpcRecognitionOptions = {
  /**
   * Where to append the recognition layer. Defaults to
   * `document.body`. A scene renderer that owns a portrait mount
   * point passes that element so the ring / subtitle can layer
   * against the portrait rather than the page root.
   */
  target?: HTMLElement;
  /**
   * Copy used for the visible caption + accessible name. Defaults to
   * `"{Io|Orra} remembers you"` — the neutral recognition label the
   * ring animates into. A future author-controlled line can be piped
   * in here without touching the feel envelope.
   */
  label?: string;
  /**
   * When true, motion distance (portrait push-in px, ring scale,
   * subtitle pop distance) collapses to 0 and the audio-cue delay
   * is zeroed. The layer still mounts + tears down on the same
   * timeline so the beat REMAINS observable — reduced-motion is a
   * motion-and-audio suppression, not a beat suppression.
   */
  reducedMotion?: boolean;
};

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

/**
 * Mount the recognition layer for a dialogue whose
 * `recognitionFeel` is non-null. Returns `null` when the dialogue
 * has no feel (first-session contact — the resolver only stamps a
 * feel row on a returning-recognition dialogue) OR when no DOM is
 * available (worker / SSR import path). A caller that receives
 * `null` should simply proceed with the dialogue lines — a missing
 * recognition beat is not an error.
 */
export function playAftersignRememberingNpcRecognitionFeel(
  dialogue: AftersignRememberingNpcDialogue,
  options: PlayAftersignRememberingNpcRecognitionOptions = {},
): AftersignRememberingNpcRecognitionHandle | null {
  const feel = dialogue.recognitionFeel;
  if (!feel) return null;

  const boundDocument =
    (globalThis as { document?: Document }).document ?? null;
  if (!boundDocument) return null;

  const target = options.target ?? boundDocument.body;
  if (!target) return null;

  const { label, reducedMotion = false } = options;

  const layer = boundDocument.createElement("div");
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

  const timerHost =
    (globalThis as { window?: Window }).window ??
    (globalThis as unknown as Window);
  const cleanupTimer = timerHost.setTimeout(() => {
    layer.remove();
  }, cleanupDelayMs);

  return {
    layer,
    remove: () => {
      timerHost.clearTimeout(cleanupTimer);
      layer.remove();
    },
  };
}

/**
 * The pure feel row exposed as a getter so a consumer test can read
 * the canonical envelope timings without importing
 * `verticalSliceRuntimeState` directly. Same object identity as
 * `AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL`.
 */
export function getAftersignRememberingNpcRecognitionFeel(): AftersignRememberingNpcRecognitionFeel {
  return AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;
}
