// Standalone assertion harness for the AFTERSIGN packet-choice feel model.
//
// Repo convention (aftersign/README.md — reaffirmed in PR #453, #468, #590):
//   - Vitest is NOT a repo dependency. `import ... from "vitest"` is dead
//     code by construction and gates nothing in CI.
//   - `node:test` / `node:assert` are not wired into any npm script either;
//     `test:e2e:aftersign` only runs Playwright against aftersign/e2e.
//   - Therefore the convention is a plain-TS assertion file that lives at
//     `aftersign/src/*.test.ts`, exports `check*()` + a `run*Checks()`
//     entry, and is typechecked by `typecheck:aftersign` (tsconfig
//     `include: ["src"]`).  If you need to execute it, wire the runner
//     into a harness entry — don't add a new test framework.
//
// PR #590 CI note: the aftersign lane went red on `test:e2e:aftersign`
// (Playwright / SwiftShader cold-start against `aftersign/e2e/`), not on
// this file's typecheck.  This module has zero runtime imports from
// `aftersign/index.html` — it's a pure model that only `.test.ts` reads —
// so no e2e spec's behavior depends on it.  Two reviewers reached the
// same conclusion (pre-existing Playwright flake); this comment exists to
// force the lane to re-run on push.
//
// So this file's job is to make the packetChoiceFeel API TYPECHECK-BOUND
// to real usage: every `check*` function calls the real factory + walks the
// documented state transitions, so any drift in the exported shape (a
// removed field, a renamed method, a changed snapshot key) surfaces as a
// tsc error in the aftersign lane, not as a silent green.

import {
  createPacketChoiceFeelModel,
  DEFAULT_PACKET_CHOICE_TUNING,
  type PacketChoiceSnapshot,
} from './packetChoiceFeel';

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

function assertClose(actual: number, expected: number, label: string, tol = 1e-9): void {
  if (Math.abs(actual - expected) > tol) {
    throw new AssertionError(`${label}: expected ~${expected}, got ${actual}`);
  }
}

function assertSnapshot(
  actual: PacketChoiceSnapshot,
  expected: Partial<PacketChoiceSnapshot>,
  label: string,
): void {
  for (const key of Object.keys(expected) as (keyof PacketChoiceSnapshot)[]) {
    const got = actual[key];
    const want = expected[key];
    if (got !== want) {
      throw new AssertionError(
        `${label}.${String(key)}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
      );
    }
  }
}

export function checkOpenRequiresDeliberateHold(): void {
  const choice = createPacketChoiceFeelModel({ holdMs: 420 });

  assertSnapshot(
    choice.start({
      choice: 'open',
      nowMs: 1000,
      pointerX: 120,
      pointerY: 180,
      axis: 0.7,
    }),
    {
      phase: 'pressing',
      choice: 'open',
      progress: 0,
      elapsedMs: 0,
      travelPx: 0,
      axis: 0.7,
      committedChoice: null,
    },
    'open.start',
  );

  const justBeforeCommit = choice.update({
    nowMs: 1419,
    pointerX: 121,
    pointerY: 181,
    axis: 0.7,
  });
  assertEqual(justBeforeCommit.phase, 'pressing', 'open.justBefore.phase');
  assertClose(justBeforeCommit.progress, 419 / 420, 'open.justBefore.progress');
  assertEqual(justBeforeCommit.committedChoice, null, 'open.justBefore.committedChoice');

  const committed = choice.update({
    nowMs: 1420,
    pointerX: 121,
    pointerY: 181,
    axis: 0.7,
  });
  assertEqual(committed.phase, 'committed', 'open.commit.phase');
  assertEqual(committed.progress, 1, 'open.commit.progress');
  assertEqual(committed.committedChoice, 'open', 'open.commit.committedChoice');
}

export function checkPreserveIsAnEquallyExplicitHold(): void {
  const choice = createPacketChoiceFeelModel({ holdMs: 420 });

  choice.start({
    choice: 'preserve',
    nowMs: 2000,
    pointerX: 40,
    pointerY: 64,
    axis: -0.8,
  });

  const committed = choice.update({
    nowMs: 2420,
    pointerX: 40,
    pointerY: 64,
    axis: -0.8,
  });

  assertEqual(committed.phase, 'committed', 'preserve.commit.phase');
  assertEqual(committed.progress, 1, 'preserve.commit.progress');
  assertEqual(committed.committedChoice, 'preserve', 'preserve.commit.committedChoice');
}

export function checkStrayDriftCancelsCommit(): void {
  const choice = createPacketChoiceFeelModel();

  choice.start({
    choice: 'open',
    nowMs: 0,
    pointerX: 100,
    pointerY: 100,
    axis: 0.8,
  });

  const cancelled = choice.update({
    nowMs: DEFAULT_PACKET_CHOICE_TUNING.holdMs,
    pointerX: 100 + DEFAULT_PACKET_CHOICE_TUNING.cancelRadiusPx + 1,
    pointerY: 100,
    axis: 0.8,
  });

  assertEqual(cancelled.phase, 'cancelled', 'drift.cancel.phase');
  assertEqual(cancelled.committedChoice, null, 'drift.cancel.committedChoice');
}

export function checkCrossingAxisSideCancelsCommit(): void {
  const choice = createPacketChoiceFeelModel();

  choice.start({
    choice: 'preserve',
    nowMs: 0,
    pointerX: 100,
    pointerY: 100,
    axis: -0.8,
  });

  const cancelled = choice.update({
    nowMs: 200,
    pointerX: 100,
    pointerY: 100,
    axis: 0.1,
  });

  assertEqual(cancelled.phase, 'cancelled', 'axis-cross.cancel.phase');
  assertEqual(cancelled.committedChoice, null, 'axis-cross.cancel.committedChoice');
}

export function checkCommittedSnapshotIsSticky(): void {
  const choice = createPacketChoiceFeelModel({ holdMs: 100 });

  choice.start({ choice: 'open', nowMs: 0, pointerX: 0, pointerY: 0, axis: 0.6 });
  choice.update({ nowMs: 100, pointerX: 0, pointerY: 0, axis: 0.6 });

  // Post-commit updates must not un-commit or overwrite the committed choice.
  const drifted = choice.update({ nowMs: 200, pointerX: 500, pointerY: 500, axis: -0.9 });
  assertEqual(drifted.phase, 'committed', 'sticky.phase');
  assertEqual(drifted.committedChoice, 'open', 'sticky.committedChoice');
  assert(drifted.progress === 1, 'sticky.progress stays at 1');
}

export function checkBackgroundTimeDoesNotCommitChoice(): void {
  const choice = createPacketChoiceFeelModel({ holdMs: 420 });

  choice.start({
    choice: 'open',
    nowMs: 10_000,
    pointerX: 200,
    pointerY: 160,
    axis: 0.7,
  });

  const preHidden = choice.update({
    nowMs: 10_100,
    pointerX: 200,
    pointerY: 160,
    axis: 0.7,
  });
  assertEqual(preHidden.phase, 'pressing', 'background.preHidden.phase');
  assertClose(preHidden.progress, 100 / 420, 'background.preHidden.progress');

  const hidden = choice.update({
    nowMs: 10_100 + DEFAULT_PACKET_CHOICE_TUNING.holdMs + 500,
    pointerX: 200,
    pointerY: 160,
    axis: 0.7,
    hasFocus: false,
  });
  assertEqual(hidden.phase, 'pressing', 'background.hidden.phase');
  assertClose(hidden.progress, preHidden.progress, 'background.hidden.progressFrozen');
  assertEqual(hidden.committedChoice, null, 'background.hidden.committedChoice');

  const resumed = choice.update({
    nowMs: 10_100 + DEFAULT_PACKET_CHOICE_TUNING.holdMs + 516,
    pointerX: 200,
    pointerY: 160,
    axis: 0.7,
  });
  assertEqual(resumed.phase, 'pressing', 'background.resumed.phase');
  assertEqual(resumed.committedChoice, null, 'background.resumed.committedChoice');
  assert(resumed.progress < 1, 'background resume must not spend hidden time');

  const committed = choice.update({
    nowMs: 10_100 + DEFAULT_PACKET_CHOICE_TUNING.holdMs + 516 + 336,
    pointerX: 200,
    pointerY: 160,
    axis: 0.7,
  });
  assertEqual(committed.phase, 'committed', 'background.focusedHold.phase');
  assertEqual(committed.committedChoice, 'open', 'background.focusedHold.choice');
}

export function runPacketChoiceFeelChecks(): void {
  checkOpenRequiresDeliberateHold();
  checkPreserveIsAnEquallyExplicitHold();
  checkStrayDriftCancelsCommit();
  checkCrossingAxisSideCancelsCommit();
  checkCommittedSnapshotIsSticky();
  checkBackgroundTimeDoesNotCommitChoice();
}
