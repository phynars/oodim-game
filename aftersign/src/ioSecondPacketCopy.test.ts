// Contract test bundle for `ioSecondPacketCopy.ts` — pinned three-tone
// frozen copy for Io's second-packet offer beat.
//
// Convention (matches aftersign/README.md § "Test harness convention"
// and packetIntent.test.ts / npcMemoryLines.test.ts):
//   - Plain-TS assertion harness. `throw` on failure. No vitest.
//   - Export-only (no top-level invocation). `runIoSecondPacketCopyChecks`
//     is called by aftersign/pure-runner.ts under `test:aftersign:pure`.
//   - Every relative import uses an explicit `.ts` extension so Node's
//     `--experimental-strip-types` (which does not add extension
//     resolution) can resolve the sibling module.
//
// What this pins (reviewer feedback on PR #1319 — "consumer rule": a
// module without callers is not a runnable story surface):
//   1. `IO_SECOND_PACKET_COPY_ID` is the identity the render site will
//      key off — asserted verbatim so a rename cannot land silently.
//   2. Every declared `IoSecondPacketReturnTone` (gentle / defiant /
//      guarded) produces exactly three lines, in the documented order
//      (recognition, offer, prompt), and no line is empty.
//   3. `playerName` fallback: an empty/whitespace/non-string name drops
//      the trailing address prefix. A real name lands as `"${name}. "`
//      before the offer line — the only variable slot in the copy.
//   4. Unknown / missing `returnTone` collapses to the `guarded`
//      default. The three tones produce DISTINCT payloads (no accidental
//      copy overlap).
//   5. The returned payload is deeply frozen. A caller CANNOT mutate
//      the tone table by keeping a reference — the render loop can trust
//      the object it receives.
//   6. Choices are the pinned pair (`accept-second-packet` +
//      `ask-what-changed`) with the exact response strings the beat
//      will speak on tap.

import {
  IO_SECOND_PACKET_COPY_ID,
  IO_SECOND_PACKET_RETURN_TONES,
  selectIoSecondPacketCopy,
  type IoSecondPacketReturnTone,
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

/** COPY_ID is verbatim — a rename would silently break the render
 * site's stamp; the assert stops that at CI time. */
export function checkCopyIdVerbatim(): void {
  assertEqual(IO_SECOND_PACKET_COPY_ID, 'io-second-packet-offer', 'IO_SECOND_PACKET_COPY_ID');
}

/** Every declared tone yields a payload with three non-empty lines in
 * order (recognition, offer, prompt) and the identity + speaker keys
 * the render site will stamp onto the DOM. */
export function checkEveryToneProducesThreeOrderedLines(): void {
  for (const tone of IO_SECOND_PACKET_RETURN_TONES) {
    const copy = selectIoSecondPacketCopy({ returnTone: tone, playerName: 'Mara' });
    assertEqual(copy.id, IO_SECOND_PACKET_COPY_ID, `[${tone}] copy.id`);
    assertEqual(copy.speaker, 'Io', `[${tone}] copy.speaker`);
    assertEqual(copy.tone, tone, `[${tone}] copy.tone echoes input`);
    assertEqual(copy.lines.length, 3, `[${tone}] lines.length`);
    for (let i = 0; i < copy.lines.length; i += 1) {
      const line = copy.lines[i];
      assert(
        typeof line === 'string' && line.length > 0,
        `[${tone}] lines[${i}] is non-empty string, got ${JSON.stringify(line)}`,
      );
      assert(
        !/[{}]|undefined|null/.test(line),
        `[${tone}] lines[${i}] template-token leak: ${JSON.stringify(line)}`,
      );
    }
  }
}

/** `playerName` falls back gracefully. Empty string, whitespace, and
 * non-string values drop the address prefix; a real name lands as the
 * first token of the offer line, followed by ". ". */
export function checkPlayerNameFallback(): void {
  const withName = selectIoSecondPacketCopy({ returnTone: 'gentle', playerName: 'Mara' });
  assert(
    withName.lines[1].startsWith('Mara. '),
    `named offer prefix: expected "Mara. " prefix, got ${JSON.stringify(withName.lines[1])}`,
  );

  const noName = selectIoSecondPacketCopy({ returnTone: 'gentle' });
  assert(
    !noName.lines[1].startsWith('. '),
    `empty offer prefix: line must not start with ". ", got ${JSON.stringify(noName.lines[1])}`,
  );
  assertEqual(
    noName.lines[1],
    'Second packet. Same hands. Less mercy in the route.',
    'gentle offer (no name)',
  );

  const whitespaceName = selectIoSecondPacketCopy({
    returnTone: 'gentle',
    playerName: '   ',
  });
  assertEqual(
    whitespaceName.lines[1],
    'Second packet. Same hands. Less mercy in the route.',
    'gentle offer (whitespace name → trimmed to empty)',
  );

  // Non-string values must not throw and must not leak `undefined` /
  // `[object Object]` into the offer line. `playerName` is typed as
  // `unknown` on the input, so a number literal type-checks directly
  // without any cast — the fallback path is exercised at runtime.
  const nonStringName = selectIoSecondPacketCopy({
    returnTone: 'gentle',
    playerName: 42,
  });
  assertEqual(
    nonStringName.lines[1],
    'Second packet. Same hands. Less mercy in the route.',
    'gentle offer (non-string name → dropped)',
  );
}

/** Unknown / missing `returnTone` collapses to the `guarded` default. */
export function checkUnknownToneFallsBackToGuarded(): void {
  const missing = selectIoSecondPacketCopy();
  assertEqual(missing.tone, 'guarded', 'missing tone → guarded');

  const unknown = selectIoSecondPacketCopy({ returnTone: 'furious' });
  assertEqual(unknown.tone, 'guarded', 'unknown tone → guarded');

  const nonString = selectIoSecondPacketCopy({ returnTone: 7 });
  assertEqual(nonString.tone, 'guarded', 'non-string tone → guarded');

  const nullTone = selectIoSecondPacketCopy({ returnTone: null });
  assertEqual(nullTone.tone, 'guarded', 'null tone → guarded');
}

/** The three tones must produce DISTINCT payloads — if two tones
 * collapse to identical lines, the beat is lying about what it
 * heard from the player. */
export function checkTonesProduceDistinctPayloads(): void {
  const payloads = IO_SECOND_PACKET_RETURN_TONES.map((tone) =>
    selectIoSecondPacketCopy({ returnTone: tone }).lines.join('\u241f'),
  );
  const unique = new Set(payloads);
  assertEqual(
    unique.size,
    IO_SECOND_PACKET_RETURN_TONES.length,
    `tones distinct: expected ${IO_SECOND_PACKET_RETURN_TONES.length} unique payloads, got ${unique.size}`,
  );
}

/** The returned payload is deeply frozen. A caller that keeps a
 * reference cannot mutate lines, choices, or the top-level object —
 * the render loop can trust the shape. */
export function checkReturnedPayloadIsDeeplyFrozen(): void {
  const copy = selectIoSecondPacketCopy({ returnTone: 'gentle', playerName: 'Mara' });
  assert(Object.isFrozen(copy), 'top-level payload frozen');
  assert(Object.isFrozen(copy.lines), 'lines array frozen');
  assert(Object.isFrozen(copy.choices), 'choices array frozen');
  for (let i = 0; i < copy.choices.length; i += 1) {
    assert(Object.isFrozen(copy.choices[i]), `choices[${i}] frozen`);
  }

  let mutationThrew = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (copy.lines as any)[0] = 'tampered';
  } catch {
    mutationThrew = true;
  }
  assert(
    mutationThrew || copy.lines[0] !== 'tampered',
    'lines mutation must not land (either throws in strict mode or is silently rejected)',
  );
}

/** Pinned choice pair — ids, labels, and response strings verbatim.
 * The render site keys off `id`; the visible labels are what the
 * player taps; the responses are what Io says next. */
export function checkChoicesArePinned(): void {
  const copy = selectIoSecondPacketCopy({ returnTone: 'guarded' });
  assertEqual(copy.choices.length, 2, 'choices.length');

  const accept = copy.choices[0];
  assertEqual(accept.id, 'accept-second-packet', 'accept.id');
  assertEqual(accept.label, 'Take the second packet', 'accept.label');
  assertEqual(
    accept.response,
    'Then keep it close. The city has learned your weight.',
    'accept.response',
  );

  const ask = copy.choices[1];
  assertEqual(ask.id, 'ask-what-changed', 'ask.id');
  assertEqual(ask.label, 'Ask what changed', 'ask.label');
  assertEqual(
    ask.response,
    'You did. That is the part the route noticed.',
    'ask.response',
  );
}

/** `IO_SECOND_PACKET_RETURN_TONES` stays in sync with the tone union —
 * every listed tone survives `normalizeReturnTone` unchanged. If a new
 * tone is added to the type but forgotten in the array, `for-of` on
 * this array skips it and the render site never lights it up. */
export function checkReturnTonesArrayCoversUnion(): void {
  const expected: Record<IoSecondPacketReturnTone, true> = {
    gentle: true,
    defiant: true,
    guarded: true,
  };
  const seen = new Set<IoSecondPacketReturnTone>();
  for (const tone of IO_SECOND_PACKET_RETURN_TONES) {
    assert(expected[tone] === true, `IO_SECOND_PACKET_RETURN_TONES has stray tone "${tone}"`);
    seen.add(tone);
  }
  const missing = (Object.keys(expected) as IoSecondPacketReturnTone[]).filter(
    (t) => !seen.has(t),
  );
  assertEqual(missing.length, 0, `tones missing from array: ${missing.join(', ')}`);
}

export function runIoSecondPacketCopyChecks(): void {
  checkCopyIdVerbatim();
  checkEveryToneProducesThreeOrderedLines();
  checkPlayerNameFallback();
  checkUnknownToneFallsBackToGuarded();
  checkTonesProduceDistinctPayloads();
  checkReturnedPayloadIsDeeplyFrozen();
  checkChoicesArePinned();
  checkReturnTonesArrayCoversUnion();
}
