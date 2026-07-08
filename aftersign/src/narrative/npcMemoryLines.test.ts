// Standalone assertion harness for buildRememberingLine + isRememberingLine.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (vitest is not a dependency — see PR #453 review and
// aftersign/README.md § "Test harness convention"), so this file matches
// the recognitionFeedback.test.ts / memory-store.test.ts convention: a
// plain-TS harness that `throw`s on failure. At typecheck time it's just
// a module with exported check functions.
//
// Why unit tests here at all: PR #502's reviewer (Mara) blocked on the
// BRIEF's "Extend the gameplay harness before the gameplay" rule —
// NPC-memory round-trips must have CI-for-narrative. This file gives the
// pure module its own guard; the round-trip against the live runtime
// lives in ../../e2e/npc-memory-line-contract.spec.ts.
import {
  buildRememberingLine,
  isRememberingLine,
  MEMORY_CUES,
  type MemoryCue,
} from './npcMemoryLines';

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

const NPC = 'Io';
const PLAYER = 'Mara';

/** Every declared MemoryCue produces a well-formed line — exhaustive so a
 * new cue added to the union without a template can't ship silently. */
export function checkEveryCueProducesAWellFormedLine(): void {
  for (const cue of MEMORY_CUES) {
    const line = buildRememberingLine({ npcName: NPC, playerName: PLAYER, cue });
    assert(
      line.startsWith(`${NPC}: `),
      `[${cue}] speaker prefix: expected "${NPC}: " prefix, got ${JSON.stringify(line)}`,
    );
    assert(
      line.includes(PLAYER),
      `[${cue}] player-name substitution: line does not contain "${PLAYER}" → ${JSON.stringify(line)}`,
    );
    assert(
      !/[{}]|undefined|null/.test(line),
      `[${cue}] template-token leak: line contains "{", "}", "undefined", or "null" → ${JSON.stringify(line)}`,
    );
    assert(
      isRememberingLine(line, { npcName: NPC, playerName: PLAYER }),
      `[${cue}] isRememberingLine self-check failed for ${JSON.stringify(line)}`,
    );
  }
}

/** MEMORY_CUES stays in sync with the MemoryCue union — every declared
 * cue appears in the array, and every array entry is a valid cue. Guards
 * against a cue being added to the type but forgotten in the runtime-
 * visible array (or vice versa). */
export function checkMemoryCuesCoversTheUnion(): void {
  // Exhaustive expected set — mirrors every MemoryCue member. If a new
  // cue is added to the union, the `Record<MemoryCue, true>` type forces
  // this literal to be updated too, so the test can't silently pass on
  // a stale definition.
  const expected: Record<MemoryCue, true> = {
    'first-meeting': true,
    'kept-promise': true,
    'broke-promise': true,
    'left-mid-conversation': true,
    'returned-after-absence': true,
  };
  const seen = new Set<MemoryCue>();
  for (const cue of MEMORY_CUES) {
    assert(expected[cue] === true, `MEMORY_CUES entry "${cue}" is not in MemoryCue`);
    seen.add(cue);
  }
  const missing = (Object.keys(expected) as MemoryCue[]).filter((c) => !seen.has(c));
  assertEqual(missing.length, 0, `MemoryCue members missing from MEMORY_CUES: ${missing.join(', ')}`);
}

/** Cue templates are distinguishable — no two cues collapse to the same
 * output. If they did, the recognition beat would be lying about what it
 * remembers. */
export function checkCuesProduceDistinctLines(): void {
  const lines = MEMORY_CUES.map((cue) =>
    buildRememberingLine({ npcName: NPC, playerName: PLAYER, cue }),
  );
  const unique = new Set(lines);
  assertEqual(unique.size, lines.length, `distinct cue outputs: expected ${lines.length}, got ${unique.size}`);
}

/** Exact-string spot check for one cue — proves the substitution actually
 * lands the player's name in the expected slot, not just "somewhere". */
export function checkKeptPromiseExactShape(): void {
  const line = buildRememberingLine({
    npcName: 'Io',
    playerName: 'Mara',
    cue: 'kept-promise',
  });
  assertEqual(
    line,
    'Io: You said you’d come back, Mara. You did. That matters here.',
    'kept-promise exact string',
  );
}

/** isRememberingLine rejects malformed inputs — the invariant the e2e
 * harness will use on live `window.__game.npcs.io.lastLine`. */
export function checkIsRememberingLineRejectsMalformed(): void {
  const ok = 'Io: You said you’d come back, Mara. You did. That matters here.';
  assert(
    isRememberingLine(ok, { npcName: 'Io', playerName: 'Mara' }),
    'isRememberingLine should accept a well-formed line',
  );
  assert(
    !isRememberingLine(null, { npcName: 'Io', playerName: 'Mara' }),
    'isRememberingLine should reject null',
  );
  assert(
    !isRememberingLine('', { npcName: 'Io', playerName: 'Mara' }),
    'isRememberingLine should reject empty string',
  );
  assert(
    !isRememberingLine('Mara said hello', { npcName: 'Io', playerName: 'Mara' }),
    'isRememberingLine should reject a line missing the speaker prefix',
  );
  assert(
    !isRememberingLine('Io: welcome back.', { npcName: 'Io', playerName: 'Mara' }),
    'isRememberingLine should reject a line that does not mention the player',
  );
  assert(
    !isRememberingLine('Io: hello {playerName}, welcome.', {
      npcName: 'Io',
      playerName: 'Mara',
    }),
    'isRememberingLine should reject a line with an unresolved template token',
  );
  assert(
    !isRememberingLine('Io: hello Mara, undefined memory.', {
      npcName: 'Io',
      playerName: 'Mara',
    }),
    'isRememberingLine should reject a line containing "undefined"',
  );
}

export function runNpcMemoryLineChecks(): void {
  checkEveryCueProducesAWellFormedLine();
  checkMemoryCuesCoversTheUnion();
  checkCuesProduceDistinctLines();
  checkKeptPromiseExactShape();
  checkIsRememberingLineRejectsMalformed();
}
