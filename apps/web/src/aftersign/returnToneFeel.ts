export type ReturnToneFeelPhase =
  | "choice-open"
  | "option-hover"
  | "option-press"
  | "reply-reveal"
  | "next-job-handoff";

export type ReturnToneFeelCue = {
  phase: ReturnToneFeelPhase;
  durationMs: number;
  easing: "linear" | "ease-out" | "ease-out-back" | "ease-in-out";
  translateYPx?: number;
  scale?: number;
  opacity?: number;
  screenShakePx?: number;
  audioCue?: "soft-click" | "thread-chime" | "job-handoff";
};

/**
 * Player-visible feel constants for the M-CONTINUE return-tone fork.
 * Keep these values concrete so the served page and playtest can agree on
 * the tap response without re-litigating the choreography in every handler.
 */
export const RETURN_TONE_FEEL_CUES: readonly ReturnToneFeelCue[] = [
  {
    phase: "choice-open",
    durationMs: 180,
    easing: "ease-out-back",
    translateYPx: -8,
    scale: 1.02,
    opacity: 1,
    audioCue: "thread-chime",
  },
  {
    phase: "option-hover",
    durationMs: 90,
    easing: "ease-out",
    translateYPx: -2,
    scale: 1.01,
  },
  {
    phase: "option-press",
    durationMs: 70,
    easing: "ease-in-out",
    translateYPx: 1,
    scale: 0.985,
    screenShakePx: 1,
    audioCue: "soft-click",
  },
  {
    phase: "reply-reveal",
    durationMs: 220,
    easing: "ease-out",
    translateYPx: -6,
    opacity: 1,
    audioCue: "thread-chime",
  },
  {
    phase: "next-job-handoff",
    durationMs: 260,
    easing: "ease-out-back",
    translateYPx: -10,
    scale: 1.025,
    screenShakePx: 2,
    audioCue: "job-handoff",
  },
] as const;

export function getReturnToneFeelCue(phase: ReturnToneFeelPhase): ReturnToneFeelCue {
  const cue = RETURN_TONE_FEEL_CUES.find((candidate) => candidate.phase === phase);

  if (!cue) {
    throw new Error(`Unknown return-tone feel phase: ${phase}`);
  }

  return cue;
}
