// Standalone assertion harness for ioMemoryLines — Io's returning-session
// recall copy.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (vitest is not a dependency — see PR #453 review and
// aftersign/README.md § "Test harness convention"), so this file matches
// the recognitionFeedback.test.ts / npcMemoryLines.test.ts convention:
// a plain-TS harness that `throw`s on failure. At typecheck time it's
// just a module with exported check functions.
//
// Priority under test — Io's returning-session dialogue chooses the
// most specific memory available:
//
//   primary   : firstPacketOutcome  →  otherwise a generic "you came back"
//   secondary : firstRouteBehavior  →  returnTone  →  undefined
//
// Together these produce the "packet > route > returnTone > default"
// fallback ladder documented in the flagship voice notes; this file
// pins that ladder so a future edit to either function can't silently
// swap the order.
import {
  getIoReturningMemoryLine,
  getIoSecondaryMemoryLine,
  IO_RETURN_TONE_LINES,
  IO_RETURNING_MEMORY_LINES,
  IO_ROUTE_MEMORY_LINES,
  type IoMemoryState,
} from './ioMemoryLines';

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

/** Empty memory produces Io's neutral "you came back" line for the
 * primary slot and no secondary line — the "cold" first-return case
 * where nothing specific has been recorded yet. */
export function checkEmptyMemoryFallsBackToDefaults(): void {
  const empty: IoMemoryState = {};
  assertEqual(
    getIoReturningMemoryLine(empty),
    'Back again. Good. Vey is less cruel to repeat witnesses.',
    'empty memory primary line',
  );
  assertEqual(getIoSecondaryMemoryLine(empty), undefined, 'empty memory secondary line');
}

/** Packet outcome drives the primary line — sealed and opened both
 * produce their audited variants. */
export function checkPacketOutcomeDrivesPrimaryLine(): void {
  assertEqual(
    getIoReturningMemoryLine({ firstPacketOutcome: 'sealed' }),
    IO_RETURNING_MEMORY_LINES.sealed,
    'primary line for sealed packet',
  );
  assertEqual(
    getIoReturningMemoryLine({ firstPacketOutcome: 'opened' }),
    IO_RETURNING_MEMORY_LINES.opened,
    'primary line for opened packet',
  );
}

/** Route behavior alone drives the secondary line when no return-tone
 * exists — this is the middle rung of the ladder. */
export function checkRouteBehaviorDrivesSecondaryLine(): void {
  assertEqual(
    getIoSecondaryMemoryLine({ firstRouteBehavior: 'listened' }),
    IO_ROUTE_MEMORY_LINES.listened,
    'secondary line for listened route',
  );
  assertEqual(
    getIoSecondaryMemoryLine({ firstRouteBehavior: 'skipped' }),
    IO_ROUTE_MEMORY_LINES.skipped,
    'secondary line for skipped route',
  );
}

/** Return tone is the bottom rung — used only when no packet or route
 * memory exists. All three tones produce their audited line. */
export function checkReturnToneIsSecondaryFallback(): void {
  assertEqual(
    getIoSecondaryMemoryLine({ returnTone: 'kind' }),
    IO_RETURN_TONE_LINES.kind,
    'secondary line for kind return tone',
  );
  assertEqual(
    getIoSecondaryMemoryLine({ returnTone: 'evasive' }),
    IO_RETURN_TONE_LINES.evasive,
    'secondary line for evasive return tone',
  );
  assertEqual(
    getIoSecondaryMemoryLine({ returnTone: 'blunt' }),
    IO_RETURN_TONE_LINES.blunt,
    'secondary line for blunt return tone',
  );
}

/** When route AND returnTone are both present, route wins — the priority
 * ladder must not collapse. This is the regression Soren flagged: a
 * naive edit could reorder the branches and silently downgrade route
 * memory to a tone-only line. */
export function checkRouteBehaviorBeatsReturnTone(): void {
  const bothSet: IoMemoryState = { firstRouteBehavior: 'listened', returnTone: 'blunt' };
  assertEqual(
    getIoSecondaryMemoryLine(bothSet),
    IO_ROUTE_MEMORY_LINES.listened,
    'route memory should beat return tone',
  );

  const bothSetInverse: IoMemoryState = { firstRouteBehavior: 'skipped', returnTone: 'kind' };
  assertEqual(
    getIoSecondaryMemoryLine(bothSetInverse),
    IO_ROUTE_MEMORY_LINES.skipped,
    'route memory should beat return tone (inverse pairing)',
  );
}

/** Full-ladder check: with packet + route + returnTone all set, the
 * primary line is packet-driven and the secondary line is route-driven —
 * returnTone stays silent because a more specific memory beat it. */
export function checkFullLadderResolvesPacketPlusRoute(): void {
  const full: IoMemoryState = {
    firstPacketOutcome: 'sealed',
    firstRouteBehavior: 'listened',
    returnTone: 'kind',
  };
  assertEqual(
    getIoReturningMemoryLine(full),
    IO_RETURNING_MEMORY_LINES.sealed,
    'full ladder primary line (packet wins)',
  );
  assertEqual(
    getIoSecondaryMemoryLine(full),
    IO_ROUTE_MEMORY_LINES.listened,
    'full ladder secondary line (route wins, returnTone silenced)',
  );
}

/** Every declared line record is non-empty and the outputs are pairwise
 * distinct — a stray copy-paste that collapsed two tones onto the same
 * string would let the recognition beat lie about what it remembers. */
export function checkAllLineRecordsAreDistinctAndNonEmpty(): void {
  const allLines = [
    ...Object.values(IO_RETURNING_MEMORY_LINES),
    ...Object.values(IO_ROUTE_MEMORY_LINES),
    ...Object.values(IO_RETURN_TONE_LINES),
  ];
  for (const line of allLines) {
    assert(typeof line === 'string' && line.length > 0, `line record entry is empty: ${JSON.stringify(line)}`);
  }
  const unique = new Set(allLines);
  assertEqual(unique.size, allLines.length, 'all Io memory lines should be pairwise distinct');
}

export function runIoMemoryLineChecks(): void {
  checkEmptyMemoryFallsBackToDefaults();
  checkPacketOutcomeDrivesPrimaryLine();
  checkRouteBehaviorDrivesSecondaryLine();
  checkReturnToneIsSecondaryFallback();
  checkRouteBehaviorBeatsReturnTone();
  checkFullLadderResolvesPacketPlusRoute();
  checkAllLineRecordsAreDistinctAndNonEmpty();
}
