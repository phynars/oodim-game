// Standalone assertion harness for the AFTERSIGN Io first-session dialogue
// pacing model.
//
// Repo convention (see aftersign/src/packetChoiceFeel.test.ts header, and
// aftersign/README.md — reaffirmed in PR #453, #468, #590):
//   - Vitest is NOT a repo dependency.
//   - `node:test` / `node:assert` are NOT usable either: `@types/node` is
//     only a transitive install and aftersign/tsconfig.json pins
//     `"types": ["vite/client"]`, so a `node:assert` import fails
//     typecheck and the aftersign lane goes red before Playwright even
//     starts (that's what killed PR #621 rev 1).
//   - Convention is a plain-TS assertion file at
//     `aftersign/src/*.test.ts`, exporting `check*()` + a `run*Checks()`
//     entry, typechecked by `typecheck:aftersign` (tsconfig
//     `include: ["src"]`). If you need to execute it, wire the runner
//     into a harness entry — don't add a new test framework.
//
// This file's job is to make the ioFirstSessionPacing API TYPECHECK-BOUND
// to real usage: every `check*` function calls the real factory and walks
// the documented pacing windows, so any drift in the exported shape
// (renamed field, changed clamp bound, dropped input lock) surfaces as a
// tsc error in the aftersign lane, not as a silent green.

import {
  canAdvanceIoFirstSessionCue,
  getIoFirstSessionCue,
} from './ioFirstSessionPacing';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function checkPacketOfferCueHasReadableHoldAndInputLock(): void {
  const cue = getIoFirstSessionCue(
    'packetOffer',
    'Blue packet. Sign box with three moths painted on it.',
  );

  assertEqual(cue.beat, 'packetOffer', 'packetOffer.beat');
  assertEqual(
    cue.text,
    'Blue packet. Sign box with three moths painted on it.',
    'packetOffer.text',
  );
  // 52 chars * 34ms/char = 1768ms, inside the [900, 2600] clamp.
  assertEqual(cue.minHoldMs, 1768, 'packetOffer.minHoldMs');
  assertEqual(cue.inputLockMs, 160, 'packetOffer.inputLockMs');
}

export function checkAdvanceRequiresBothInputLockAndReadableHold(): void {
  const cue = getIoFirstSessionCue(
    'packetOffer',
    'Blue packet. Sign box with three moths painted on it.',
  );

  assertEqual(
    canAdvanceIoFirstSessionCue(cue, cue.minHoldMs - 1),
    false,
    'advance.frameBeforeHold',
  );
  assertEqual(
    canAdvanceIoFirstSessionCue(cue, cue.minHoldMs),
    true,
    'advance.firstFrameAtHold',
  );
}

export function checkShortBarksStillGetReadableMinimum(): void {
  const cue = getIoFirstSessionCue('openedWarning', 'Knife.');

  assertEqual(cue.minHoldMs, 900, 'shortBark.minHoldMs');
  // The 160ms input lock alone must never skip a short bark before the
  // 900ms readable minimum. This is the load-bearing feel guarantee: a
  // player who mashes advance the instant a line pops cannot outrun the
  // read window.
  assertEqual(
    canAdvanceIoFirstSessionCue(cue, cue.inputLockMs),
    false,
    'shortBark.inputLockAloneCannotSkip',
  );
}

export function checkLongLinesCapTheirHold(): void {
  const cue = getIoFirstSessionCue(
    'routeInstruction',
    'Left stair, red string, brass bell. If the stair argues with you, trust the bell. Then move before the tide notices.',
  );

  assertEqual(cue.minHoldMs, 2600, 'longLine.minHoldMs');
}

export function checkEmptyCopyThrowsBeforeReturningACue(): void {
  let thrown: unknown = null;
  try {
    getIoFirstSessionCue('arrival', '   ');
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, 'emptyCopy.throws');
  assert(
    /Io first-session beat arrival needs playable copy before pacing/.test(
      (thrown as Error).message,
    ),
    `emptyCopy.messageShape: got ${(thrown as Error).message}`,
  );
}

export function runIoFirstSessionPacingChecks(): void {
  checkPacketOfferCueHasReadableHoldAndInputLock();
  checkAdvanceRequiresBothInputLockAndReadableHold();
  checkShortBarksStillGetReadableMinimum();
  checkLongLinesCapTheirHold();
  checkEmptyCopyThrowsBeforeReturningACue();
}
