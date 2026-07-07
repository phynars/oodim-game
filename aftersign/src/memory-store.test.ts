// Standalone assertion harness for the AFTERSIGN memory store.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness matching recognitionFeedback.test.ts: run it with
// `tsx` / `node --loader` if you want the assertions to execute, but
// at typecheck time it's just a module with exported check functions
// and no external imports.
import {
  createEmptySave,
  getIoRememberedLine,
  parseSave,
  rememberIoPacketChoice,
  serializeSave,
  type AftersignMemoryRecord,
  type AftersignSaveData,
} from './memory-store';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new AssertionError(`${label}: expected ${b}, got ${a}`);
  }
}

export function checkEmptySaveHasNoIoLine(): void {
  const save = createEmptySave('player-one');
  assertEqual(save.version, 1, 'empty save version');
  assertEqual(save.playerId, 'player-one', 'empty save playerId');
  assertEqual(save.routeId, 'kiosk-io-vertical-slice', 'empty save routeId');
  assertEqual(save.memories.length, 0, 'empty save memories.length');
  assertEqual(getIoRememberedLine(save), null, 'empty save Io line');
}

export function checkIoPacketChoicePersistsAcrossReload(): void {
  const firstSession = createEmptySave('player-one');
  const remembered = rememberIoPacketChoice(firstSession, 'return_unopened', '2026-07-05T00:00:00.000Z');
  const reloaded = parseSave('player-one', serializeSave(remembered));

  assertEqual(
    getIoRememberedLine(reloaded),
    'You brought the blue packet back unopened.',
    'reloaded Io line',
  );

  const expected: AftersignMemoryRecord[] = [
    {
      npcId: 'io',
      beatId: 'blue-packet-choice',
      sentence: 'You brought the blue packet back unopened.',
      trust: 'open',
      updatedAt: '2026-07-05T00:00:00.000Z',
    },
  ];
  assertDeepEqual(reloaded.memories, expected, 'reloaded memories');
}

export function checkMemoryRecordStaysSingularOnBeatChange(): void {
  const first = rememberIoPacketChoice(
    createEmptySave('player-one'),
    'return_unopened',
    '2026-07-05T00:00:00.000Z',
  );
  const second = rememberIoPacketChoice(first, 'open_and_read', '2026-07-05T00:05:00.000Z');

  assertEqual(second.memories.length, 1, 'second-choice memories.length');
  assertEqual(
    getIoRememberedLine(second),
    'You opened the blue packet before you brought it back.',
    'second-choice Io line',
  );

  const record = second.memories[0];
  assert(record !== undefined, 'second-choice memories[0] present');
  assertEqual(record.npcId, 'io', 'second-choice npcId');
  assertEqual(record.beatId, 'blue-packet-choice', 'second-choice beatId');
  assertEqual(record.trust, 'strained', 'second-choice trust');
}

export function checkInvalidOrForeignSaveFallsBackToEmpty(): void {
  const emptyForPlayerOne: AftersignSaveData = createEmptySave('player-one');

  assertDeepEqual(parseSave('player-one', '{'), emptyForPlayerOne, 'malformed JSON fallback');
  assertDeepEqual(
    parseSave('player-one', serializeSave(createEmptySave('player-two'))),
    emptyForPlayerOne,
    'foreign-player fallback',
  );
}

export function runMemoryStoreChecks(): void {
  checkEmptySaveHasNoIoLine();
  checkIoPacketChoicePersistsAcrossReload();
  checkMemoryRecordStaysSingularOnBeatChange();
  checkInvalidOrForeignSaveFallsBackToEmpty();
}
