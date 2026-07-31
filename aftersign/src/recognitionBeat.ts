export type PacketOutcome = "sealed" | "opened";

export interface RecognitionBeatCue {
  atMs: number;
  kind: "camera" | "light" | "audio" | "haptic" | "dialogue";
  label: string;
  value: number | string;
  easing?: "linear" | "easeOutCubic" | "easeInOutSine";
}

export interface RecognitionBeatPlan {
  outcome: PacketOutcome;
  durationMs: number;
  cues: RecognitionBeatCue[];
  line: string;
}

const RETURN_LINES: Record<PacketOutcome, string> = {
  sealed: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
};

export const RECOGNITION_BEAT_DURATION_MS = 1640;
export const RECOGNITION_PUSH_IN_DEGREES = 4;
export const RECOGNITION_PUSH_IN_MS = 360;
export const RECOGNITION_LANTERN_GLOW_GAIN = 1.35;
export const RECOGNITION_STING_GAIN = 0.72;
export const RECOGNITION_VISUAL_HAPTIC_SCALE_PX = 3;

export function buildIoRecognitionBeat(outcome: PacketOutcome): RecognitionBeatPlan {
  return {
    outcome,
    durationMs: RECOGNITION_BEAT_DURATION_MS,
    line: RETURN_LINES[outcome],
    cues: [
      {
        atMs: 0,
        kind: "camera",
        label: "over-shoulder push-in",
        value: RECOGNITION_PUSH_IN_DEGREES,
        easing: "easeOutCubic",
      },
      {
        atMs: 80,
        kind: "light",
        label: "Io kiosk lantern memory bloom",
        value: RECOGNITION_LANTERN_GLOW_GAIN,
        easing: "easeInOutSine",
      },
      {
        atMs: 120,
        kind: "audio",
        label: outcome === "sealed" ? "two-note bell trust sting" : "single cracked-bell recognition sting",
        value: RECOGNITION_STING_GAIN,
        easing: "linear",
      },
      {
        atMs: 120,
        kind: "haptic",
        label: "visual-only micro-screen pulse for touch devices",
        value: RECOGNITION_VISUAL_HAPTIC_SCALE_PX,
        easing: "easeOutCubic",
      },
      {
        atMs: 420,
        kind: "dialogue",
        label: "Io remembered return line",
        value: RETURN_LINES[outcome],
      },
    ],
  };
}
