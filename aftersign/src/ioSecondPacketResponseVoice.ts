// Io's SAINT-ORRA POINTER line — spoken a beat AFTER the player commits
// to one of the two second-packet choices. This is the redirect to the
// next door, not another version of the offer.
//
// SCOPE:
//   • Does NOT own the choice pair — those live in `ioSecondPacketCopy.ts`.
//     We import that type so a rename over there breaks THIS file at
//     typecheck time rather than silently at runtime.
//   • Owns the follow-up line only. The choice's immediate reply
//     (`IoSecondPacketChoice.response`) still lives on the sibling.
//
// Consumers:
//   1. `ioSecondPacketResponseVoice.test.ts` — pure-lane contract test
//      registered in `aftersign/pure-runner.ts`. Asserts distinct + non-
//      empty pointer lines, both name "Saint Orra", unknown ids fall
//      back to the accept pointer, the table is frozen, and its keys
//      match the sibling choice contract.
//   2. `aftersign/main.js` → `stampIoSecondPacketPointer` at the render
//      site. The accept-path fallback guarantees a non-empty paragraph
//      even for a malformed id, so we never stamp a blank `<p>`.

import type { IoSecondPacketChoice } from './ioSecondPacketCopy.ts';

export type IoSecondPacketChoiceId = IoSecondPacketChoice['id'];

const SAINT_ORRA_POINTER: Readonly<Record<IoSecondPacketChoiceId, string>> = Object.freeze({
  'accept-second-packet':
    'Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.',
  'ask-what-changed':
    'The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.',
});

/**
 * Frozen pointer table. Exported so the contract test can assert
 * freeze + key-parity against the sibling choice contract without
 * reaching into module internals — single source of truth, no fork.
 */
export const IO_SECOND_PACKET_RESPONSE_VOICE = SAINT_ORRA_POINTER;

/**
 * Return the Saint-Orra pointer line for a given second-packet choice
 * id. Unknown / non-string / missing input falls back to the accept
 * path — the beat still fires, using the more directive variant, and
 * the render site never stamps a blank paragraph.
 */
export function ioSecondPacketResponseLine(choiceId: unknown): string {
  if (
    typeof choiceId === 'string'
    && Object.prototype.hasOwnProperty.call(SAINT_ORRA_POINTER, choiceId)
  ) {
    return SAINT_ORRA_POINTER[choiceId as IoSecondPacketChoiceId];
  }
  return SAINT_ORRA_POINTER['accept-second-packet'];
}
