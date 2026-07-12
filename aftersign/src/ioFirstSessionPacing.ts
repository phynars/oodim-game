// Mirrors the five first-session copy keys in
// apps/web/src/aftersign/ioFirstSessionCopy.ts. Returning-session recognition
// beats (returnSealed / returnOpened) live in ioReturningSession — do not
// re-add them here or the two modules will drift.
export type IoFirstSessionPacingBeat =
  | "arrival"
  | "packetOffer"
  | "routeInstruction"
  | "sealedWarning"
  | "openedWarning";

export type IoFirstSessionPacingCue = {
  beat: IoFirstSessionPacingBeat;
  text: string;
  minHoldMs: number;
  inputLockMs: number;
};

const MIN_READ_MS_PER_CHARACTER = 34;
const MIN_HOLD_MS = 900;
const MAX_HOLD_MS = 2600;
const INPUT_LOCK_MS = 160;

export function getIoFirstSessionCue(
  beat: IoFirstSessionPacingBeat,
  text: string,
): IoFirstSessionPacingCue {
  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    throw new Error(`Io first-session beat ${beat} needs playable copy before pacing`);
  }

  return {
    beat,
    text: trimmedText,
    minHoldMs: clamp(
      Math.round(trimmedText.length * MIN_READ_MS_PER_CHARACTER),
      MIN_HOLD_MS,
      MAX_HOLD_MS,
    ),
    inputLockMs: INPUT_LOCK_MS,
  };
}

export function canAdvanceIoFirstSessionCue(
  cue: IoFirstSessionPacingCue,
  elapsedMs: number,
): boolean {
  return elapsedMs >= cue.inputLockMs && elapsedMs >= cue.minHoldMs;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
