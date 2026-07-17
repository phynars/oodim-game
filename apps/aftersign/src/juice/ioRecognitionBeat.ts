export type PacketOutcome = "sealed" | "opened";

export type EasingName =
  | "easeOutCubic"
  | "easeOutQuart"
  | "easeInOutSine"
  | "linear";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraCue {
  startMs: number;
  durationMs: number;
  pushInMeters: number;
  riseMeters: number;
  yawDegrees: number;
  pitchDegrees: number;
  easing: EasingName;
}

export interface VisualCue {
  startMs: number;
  durationMs: number;
  target: "io-lantern" | "packet-seal" | "kiosk-sign" | "rain-rim";
  intensityFrom: number;
  intensityTo: number;
  color: string;
  easing: EasingName;
}

export interface AudioCue {
  startMs: number;
  id: "bell-soft" | "seal-wax-click" | "seal-paper-tear" | "sign-hum-rise";
  gainDb: number;
  pan: number;
}

export interface HapticScaleCue {
  startMs: number;
  durationMs: number;
  amplitude: number;
  note: string;
}

export interface IoRecognitionBeat {
  id: string;
  line: string;
  totalDurationMs: number;
  playerInputLockMs: number;
  camera: CameraCue;
  visuals: VisualCue[];
  audio: AudioCue[];
  hapticScale: HapticScaleCue;
}

export const IO_RECOGNITION_TOTAL_MS = 1320;

const SEALED_LINE =
  "You came back. So did the blue seal, unbroken. That gives me two facts to trust.";

const OPENED_LINE =
  "You came back. The seal did not. I can use one of those facts.";

const SHARED_CAMERA: CameraCue = {
  startMs: 0,
  durationMs: 520,
  pushInMeters: 0.42,
  riseMeters: 0.06,
  yawDegrees: -1.4,
  pitchDegrees: -1.8,
  easing: "easeOutCubic",
};

export function buildIoRecognitionBeat(outcome: PacketOutcome): IoRecognitionBeat {
  const isSealed = outcome === "sealed";

  return {
    id: `io-recognition-${outcome}`,
    line: isSealed ? SEALED_LINE : OPENED_LINE,
    totalDurationMs: IO_RECOGNITION_TOTAL_MS,
    playerInputLockMs: 620,
    camera: SHARED_CAMERA,
    visuals: [
      {
        startMs: 80,
        durationMs: 360,
        target: "io-lantern",
        intensityFrom: 1.0,
        intensityTo: isSealed ? 1.42 : 1.18,
        color: isSealed ? "#ffc56a" : "#d8f1ff",
        easing: "easeOutQuart",
      },
      {
        startMs: 120,
        durationMs: 240,
        target: "packet-seal",
        intensityFrom: isSealed ? 0.9 : 0.35,
        intensityTo: isSealed ? 1.7 : 0.7,
        color: isSealed ? "#b94338" : "#8aa4ad",
        easing: "easeOutCubic",
      },
      {
        startMs: 220,
        durationMs: 520,
        target: "kiosk-sign",
        intensityFrom: 0.7,
        intensityTo: isSealed ? 1.35 : 1.05,
        color: "#f4efe0",
        easing: "easeInOutSine",
      },
      {
        startMs: 260,
        durationMs: 420,
        target: "rain-rim",
        intensityFrom: 0.0,
        intensityTo: 0.28,
        color: "#b7e7ff",
        easing: "easeOutCubic",
      },
    ],
    audio: [
      {
        startMs: 0,
        id: "sign-hum-rise",
        gainDb: -14,
        pan: -0.1,
      },
      {
        startMs: 130,
        id: isSealed ? "seal-wax-click" : "seal-paper-tear",
        gainDb: isSealed ? -9 : -11,
        pan: 0.08,
      },
      {
        startMs: 410,
        id: "bell-soft",
        gainDb: isSealed ? -12 : -16,
        pan: 0.0,
      },
    ],
    hapticScale: {
      startMs: 130,
      durationMs: isSealed ? 38 : 24,
      amplitude: isSealed ? 0.24 : 0.14,
      note:
        "Visual-only fallback for web: scale packet seal by amplitude * 0.018, then settle with easeOutCubic.",
    },
  };
}

export function sampleEasing(name: EasingName, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));

  if (name === "easeOutCubic") {
    return 1 - Math.pow(1 - clamped, 3);
  }

  if (name === "easeOutQuart") {
    return 1 - Math.pow(1 - clamped, 4);
  }

  if (name === "easeInOutSine") {
    return -(Math.cos(Math.PI * clamped) - 1) / 2;
  }

  return clamped;
}

export function sampleCameraOffset(cue: CameraCue, elapsedMs: number): Vec3 {
  const eased = sampleEasing(cue.easing, (elapsedMs - cue.startMs) / cue.durationMs);

  return {
    x: Math.sin((cue.yawDegrees * Math.PI) / 180) * cue.pushInMeters * eased,
    y: cue.riseMeters * eased,
    z: -cue.pushInMeters * eased,
  };
}

export function recognitionBeatAcceptance(outcome: PacketOutcome): string[] {
  const beat = buildIoRecognitionBeat(outcome);

  return [
    `Io line references ${outcome === "sealed" ? "the unbroken blue seal" : "the missing seal"}.`,
    `Camera push-in reaches ${beat.camera.pushInMeters}m over ${beat.camera.durationMs}ms with ${beat.camera.easing}.`,
    `Player input is locked for ${beat.playerInputLockMs}ms, then movement returns before the line finishes.`,
    `Packet seal audio fires at ${beat.audio[1].startMs}ms and matches the persisted packet outcome.`,
    `Recognition beat completes within ${beat.totalDurationMs}ms and leaves no modal UI on screen.`,
  ];
}
