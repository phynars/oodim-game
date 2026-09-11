// Standalone assertion harness for ioLedgerLine — Io's ledger-fact copy.
//
// Convention: the repo has no test runner wired into
// `npm run typecheck:aftersign` (vitest is not a dependency — see PR
// #453 review and aftersign/README.md § "Test harness convention"), so
// this file matches the sibling `story/ioMemoryLines.test.ts` shape:
// a plain-TS harness that `throw`s on failure. At typecheck time it's
// just a module with exported check functions.
//
// What's pinned here — the ledger-fact contract:
//
//   fact          →  line Io speaks when she names it back to the player
//   sealed        →  "The seal held. That buys you the longer route."
//   opened        →  "The seal broke. Take the route with fewer witnesses."
//   returned      →  "You came back. I kept the work that remembers that."
//
// Consumer follow-up: `chooseIoLedgerLine` is not yet wired into the
// runtime (see #1714). These checks lock the copy so the wiring PR
// can land without silently rewriting the words.

import {
  chooseIoLedgerLine,
  type IoLedgerFact,
} from './ioLedgerLine';

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

/** Every declared fact resolves to its pinned line — the sealed/opened/
 * returned copy is the contract, not a suggestion. A silent rewrite
 * inside `chooseIoLedgerLine` would let Io say something the flagship
 * script never signed off on. */
export function checkEachFactResolvesToItsLine(): void {
  assertEqual(
    chooseIoLedgerLine('sealed'),
    'The seal held. That buys you the longer route.',
    'sealed fact line',
  );
  assertEqual(
    chooseIoLedgerLine('opened'),
    'The seal broke. Take the route with fewer witnesses.',
    'opened fact line',
  );
  assertEqual(
    chooseIoLedgerLine('returned'),
    'You came back. I kept the work that remembers that.',
    'returned fact line',
  );
}

/** Every fact produces a non-empty prose line — a stray edit that
 * dropped an entry from the internal record would surface as an
 * `undefined` reaching the player. */
export function checkAllFactsProduceNonEmptyLines(): void {
  const allFacts: readonly IoLedgerFact[] = ['sealed', 'opened', 'returned'] as const;
  for (const fact of allFacts) {
    const line = chooseIoLedgerLine(fact);
    assert(
      typeof line === 'string' && line.length > 0,
      `line for fact ${JSON.stringify(fact)} should be a non-empty string, got ${JSON.stringify(line)}`,
    );
    assert(
      !/[{}]|undefined|null/.test(line),
      `line for fact ${JSON.stringify(fact)} leaks a template token: ${JSON.stringify(line)}`,
    );
  }
}

/** All three fact lines are pairwise distinct — a copy-paste that
 * collapsed two facts onto the same line would let Io claim she
 * remembers a distinction she doesn't. */
export function checkAllFactLinesAreDistinct(): void {
  const lines = [
    chooseIoLedgerLine('sealed'),
    chooseIoLedgerLine('opened'),
    chooseIoLedgerLine('returned'),
  ];
  const unique = new Set(lines);
  assertEqual(unique.size, lines.length, 'all ledger-fact lines should be pairwise distinct');
}

export function runIoLedgerLineChecks(): void {
  checkEachFactResolvesToItsLine();
  checkAllFactsProduceNonEmptyLines();
  checkAllFactLinesAreDistinct();
}
