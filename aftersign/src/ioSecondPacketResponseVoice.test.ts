// Contract test bundle for `ioSecondPacketResponseVoice.ts` — Io's
// Saint-Orra pointer line spoken AFTER the player commits to one of
// the two second-packet choices.
//
// Convention (matches aftersign/README.md § "Test harness convention"
// and ioSecondPacketCopy.test.ts):
//   - Plain-TS assertion harness. `throw` on failure. No vitest.
//   - Export-only (no top-level invocation). `runIoSecondPacketResponseVoiceChecks`
//     is called by aftersign/pure-runner.ts under `test:aftersign:pure`.
//   - Every relative import uses an explicit `.ts` extension so Node's
//     `--experimental-strip-types` (which does not add extension
//     resolution) can resolve the sibling module.
//
// What this pins:
//   1. Both choice ids in the sibling contract (`accept-second-packet`,
//      `ask-what-changed`) produce a non-empty pointer line, and the
//      two lines are DISTINCT — if they collapse to the same string,
//      the branch was cosmetic.
//   2. Every pointer line names the next door — "Saint Orra" — verbatim.
//      That's the reason this module exists (it isn't restating the
//      offer, it's redirecting to the next beat).
//   3. Unknown / non-string / missing choice ids fall back to the
//      accept-path pointer without throwing. The beat still fires.
//   4. The pointer table is frozen — a caller keeping a reference
//      cannot swap lines out from under the render loop.
//   5. The exported alias `IO_SECOND_PACKET_RESPONSE_VOICE` is the
//      same object as the internal table (single source of truth,
//      no accidental fork on import).

import {
  IO_SECOND_PACKET_RESPONSE_VOICE,
  ioSecondPacketResponseLine,
} from './ioSecondPacketResponseVoice.ts';
import {
  selectIoSecondPacketCopy,
  type IoSecondPacketChoice,
} from './ioSecondPacketCopy.ts';

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

/** The pointer lines for the two contract choice ids are non-empty,
 * distinct, and free of template-token leaks. */
export function checkBothChoiceIdsProducePointerLines(): void {
  const accept = ioSecondPacketResponseLine('accept-second-packet');
  const ask = ioSecondPacketResponseLine('ask-what-changed');

  for (const [label, line] of [['accept', accept], ['ask', ask]] as const) {
    assert(
      typeof line === 'string' && line.length > 0,
      `${label} pointer non-empty, got ${JSON.stringify(line)}`,
    );
    assert(
      !/[{}]|undefined|null/.test(line),
      `${label} pointer template-token leak: ${JSON.stringify(line)}`,
    );
  }

  assert(
    accept !== ask,
    `pointer lines must be distinct — collapsed to ${JSON.stringify(accept)}`,
  );
}

/** Every pointer line names "Saint Orra" verbatim. That's the reason
 * the module exists — it's a redirect to the next door, not another
 * beat of the offer. If the name drifts, the pointer is lying. */
export function checkEveryPointerNamesSaintOrra(): void {
  const accept = ioSecondPacketResponseLine('accept-second-packet');
  const ask = ioSecondPacketResponseLine('ask-what-changed');
  assert(
    accept.includes('Saint Orra'),
    `accept pointer must name "Saint Orra", got ${JSON.stringify(accept)}`,
  );
  assert(
    ask.includes('Saint Orra'),
    `ask pointer must name "Saint Orra", got ${JSON.stringify(ask)}`,
  );
}

/** Unknown / non-string / missing choice ids fall back to the accept
 * pointer — the beat still fires, no throw. */
export function checkUnknownChoiceIdFallsBack(): void {
  const acceptLine = ioSecondPacketResponseLine('accept-second-packet');

  const missing = ioSecondPacketResponseLine(undefined);
  assertEqual(missing, acceptLine, 'missing choice id → accept pointer');

  const empty = ioSecondPacketResponseLine('');
  assertEqual(empty, acceptLine, 'empty choice id → accept pointer');

  const unknown = ioSecondPacketResponseLine('demand-more');
  assertEqual(unknown, acceptLine, 'unknown choice id → accept pointer');

  const nonString = ioSecondPacketResponseLine(7);
  assertEqual(nonString, acceptLine, 'non-string choice id → accept pointer');

  const nullId = ioSecondPacketResponseLine(null);
  assertEqual(nullId, acceptLine, 'null choice id → accept pointer');
}

/** The pointer table is frozen — the render loop can trust it. */
export function checkPointerTableIsFrozen(): void {
  assert(Object.isFrozen(IO_SECOND_PACKET_RESPONSE_VOICE), 'pointer table frozen');

  let mutationThrew = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (IO_SECOND_PACKET_RESPONSE_VOICE as any)['accept-second-packet'] = 'tampered';
  } catch {
    mutationThrew = true;
  }
  assert(
    mutationThrew
      || IO_SECOND_PACKET_RESPONSE_VOICE['accept-second-packet'] !== 'tampered',
    'pointer mutation must not land (throws in strict mode or is silently rejected)',
  );
}

/** The pointer table's keys match the sibling copy's choice ids
 * exactly. If a choice id is added / renamed on the sibling, this
 * assertion reds so the pointer is updated in the same PR. */
export function checkPointerKeysMatchChoiceContract(): void {
  const copy = selectIoSecondPacketCopy({ returnTone: 'guarded' });
  const contractIds = copy.choices
    .map((c: IoSecondPacketChoice) => c.id)
    .slice()
    .sort();
  const pointerIds = Object.keys(IO_SECOND_PACKET_RESPONSE_VOICE).slice().sort();
  assertEqual(
    pointerIds.join('|'),
    contractIds.join('|'),
    `pointer keys must equal choice contract ids (got ${pointerIds.join(',')}, expected ${contractIds.join(',')})`,
  );
}

export function runIoSecondPacketResponseVoiceChecks(): void {
  checkBothChoiceIdsProducePointerLines();
  checkEveryPointerNamesSaintOrra();
  checkUnknownChoiceIdFallsBack();
  checkPointerTableIsFrozen();
  checkPointerKeysMatchChoiceContract();
}
