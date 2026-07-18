// AFTERSIGN packet-intent CONTRACT checks (vertical-slice memory outcome).
//
// This complements aftersign/src/packetIntent.ts's controller-invariant
// checks (`runPacketIntentChecks`, wrapped by
// aftersign/e2e/packet-intent-contract.spec.ts). Those pin the input
// controller — hold thresholds, sticky-cancel, tap ceiling. This file
// pins the OUTCOME contract one layer up: after a deliberate choice
// resolves, the persisted save distinguishes "return_unopened" from
// "open_and_read" so Io's returning-session memory can key off it.
//
// Repo convention (see aftersign/src/packetChoiceFeel.test.ts header,
// reaffirmed in PR #453 / #468 / #590 / #700, and Soren's re-review on
// #703): vitest is NOT a dependency in aftersign/. Tests are plain-TS
// `check*()` + `run*Checks()` files under `aftersign/src/`, typechecked
// by `typecheck:aftersign` (tsconfig `include: ["src"]`), and executed
// via a matching Playwright spec under `aftersign/e2e/`. A test tree
// that no CI lane touches (`apps/web/src/aftersign/`) is a green-lie —
// this file lives here on purpose.

import {
  createEmptySave,
  getIoRememberedLine,
  rememberIoPacketChoice,
  type AftersignSaveData,
} from './memory-store';

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

function assertMatch(actual: string, pattern: RegExp, label: string): void {
  if (!pattern.test(actual)) {
    throw new AssertionError(
      `${label}: expected ${actual} to match ${pattern}`,
    );
  }
}

function snapshotForHarness(save: AftersignSaveData): string {
  return JSON.stringify(save);
}

export function checkSealedAndOpenedAreDistinctDeliberateOutcomes(): void {
  const base = createEmptySave('player-contract');

  const sealed = rememberIoPacketChoice(base, 'return_unopened', '2026-07-05T00:00:00.000Z');
  const opened = rememberIoPacketChoice(base, 'open_and_read', '2026-07-05T00:00:00.000Z');

  const sealedSnapshot = snapshotForHarness(sealed);
  const openedSnapshot = snapshotForHarness(opened);

  assert(
    sealedSnapshot !== openedSnapshot,
    'sealed and opened snapshots must not be structurally identical',
  );

  assertEqual(sealed.packetChoice, 'return_unopened', 'sealed.packetChoice');
  assertEqual(opened.packetChoice, 'open_and_read', 'opened.packetChoice');

  assertMatch(sealedSnapshot, /return_unopened|unopened/i, 'sealed.snapshot mentions the sealed outcome');
  assertMatch(openedSnapshot, /open_and_read|opened the blue packet/i, 'opened.snapshot mentions the opened outcome');
}

export function checkHarnessCanInspectOutcomeBeforeIoRemembersIt(): void {
  // The vertical-slice contract: harness reads the persisted outcome
  // BEFORE Io's returning-session dialogue picks a line, so the test
  // rig can pin what Io *should* recognize on next return without
  // needing Io's scene to run.
  const sealed = rememberIoPacketChoice(
    createEmptySave('player-contract'),
    'return_unopened',
    '2026-07-05T00:00:00.000Z',
  );

  const harnessSnapshot = snapshotForHarness(sealed);

  assertMatch(harnessSnapshot, /blue-packet-choice/, 'harness snapshot exposes the beat id');
  assertMatch(harnessSnapshot, /return_unopened|unopened/i, 'harness snapshot exposes the sealed outcome');

  const line = getIoRememberedLine(sealed);
  assert(line !== null, 'Io remembered line must be inspectable from the save');
  assertMatch(line ?? '', /unopened/i, 'Io remembered line reflects the sealed outcome');
}

export function checkOutcomeIsIdempotentUnderRepeatChoice(): void {
  // A deliberate re-commit of the same outcome must not stack memories
  // or drift the harness snapshot — otherwise the harness assertion
  // above (single beat, single sentence) becomes non-deterministic.
  const base = createEmptySave('player-contract');
  const once = rememberIoPacketChoice(base, 'return_unopened', '2026-07-05T00:00:00.000Z');
  const twice = rememberIoPacketChoice(once, 'return_unopened', '2026-07-05T00:00:00.000Z');

  assertEqual(once.memories.length, 1, 'first commit produces one memory');
  assertEqual(twice.memories.length, 1, 'repeat commit does not stack memories');
  assertEqual(
    snapshotForHarness(once),
    snapshotForHarness(twice),
    'repeat commit is snapshot-stable',
  );
}

export function runPacketIntentContractChecks(): void {
  checkSealedAndOpenedAreDistinctDeliberateOutcomes();
  checkHarnessCanInspectOutcomeBeforeIoRemembersIt();
  checkOutcomeIsIdempotentUnderRepeatChoice();
}
