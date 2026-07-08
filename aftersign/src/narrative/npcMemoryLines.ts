// Pure builder for an NPC's remembering line — the sentence that lands
// when a returning NPC greets a player they recognize from a prior save.
//
// This module is the CI-for-narrative anchor for the recognition beat: the
// invariants below (`isRememberingLine`, `MEMORY_CUES`) are the same shape
// the runtime's `window.__game.npcs.io.lastLine` must obey, so the plain-TS
// unit test (`npcMemoryLines.test.ts`) and the Playwright harness spec
// (`e2e/npc-memory-line-contract.spec.ts`) can share one contract instead
// of drifting into two.

export type MemoryCue =
  | 'first-meeting'
  | 'kept-promise'
  | 'broke-promise'
  | 'left-mid-conversation'
  | 'returned-after-absence';

/** Exhaustive list of every cue `buildRememberingLine` accepts. Kept as a
 * runtime-visible array (not just the type) so tests can iterate every cue
 * without duplicating the list. */
export const MEMORY_CUES: readonly MemoryCue[] = [
  'first-meeting',
  'kept-promise',
  'broke-promise',
  'left-mid-conversation',
  'returned-after-absence',
] as const;

export type RememberingLineInput = {
  npcName: string;
  playerName: string;
  cue: MemoryCue;
};

const cueTemplates: Record<MemoryCue, (playerName: string) => string> = {
  'first-meeting': (playerName) => `We haven't done this before, ${playerName}. Speak plain and I'll do the same.`,
  'kept-promise': (playerName) => `You said you'd come back, ${playerName}. You did. That's worth more than charm.`,
  'broke-promise': (playerName) => `You said you'd come back, ${playerName}. You didn't. I left the lamp on anyway.`,
  'left-mid-conversation': (playerName) => `You left mid-sentence, ${playerName}. The silence finished it for me.`,
  'returned-after-absence': (playerName) => `Long time gone, ${playerName}. Your outline never left this room.`,
};

export function buildRememberingLine(input: RememberingLineInput): string {
  const base = cueTemplates[input.cue](input.playerName);
  return `${input.npcName}: ${base}`;
}

/** Shape invariant for any string that claims to be a remembering line.
 *
 * A line is well-formed iff:
 *   1. it contains a "<npcName>: " prefix (speaker attribution),
 *   2. the body after the prefix mentions the player by name,
 *   3. the body reads as prose — no leaking of template/system tokens
 *      (`{`, `}`, `undefined`, `null`), which would signal a broken
 *      substitution reaching the player.
 *
 * The runtime scene (`aftersign/index.html`) hand-writes its recognition
 * lines rather than importing this module — but any line landing on
 * `window.__game.npcs.io.lastLine` at the `io-returning-recognition` beat
 * MUST satisfy this same contract. The e2e spec enforces that; drift
 * between the module and the runtime shows up as a red harness.
 */
export function isRememberingLine(
  line: unknown,
  expected: { npcName: string; playerName: string },
): line is string {
  if (typeof line !== 'string' || line.length === 0) return false;
  const prefix = `${expected.npcName}: `;
  if (!line.startsWith(prefix)) return false;
  const body = line.slice(prefix.length);
  if (body.length === 0) return false;
  if (!body.includes(expected.playerName)) return false;
  if (/[{}]|undefined|null/.test(body)) return false;
  return true;
}
