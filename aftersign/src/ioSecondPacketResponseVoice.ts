// Io's SAINT-ORRA POINTER line — the beat that fires AFTER the player
// commits to one of the two second-packet choices, pointing them at
// the next door (Saint Orra) rather than restating the offer.
//
// SCOPE — what this module owns, and what it does NOT:
//   • It does NOT own the choice pair (`accept-second-packet` /
//     `ask-what-changed`) — those live in `ioSecondPacketCopy.ts`,
//     which is the single source of truth for the choice contract.
//     We import that type here so a rename on the sibling breaks
//     THIS file at typecheck time (not silently at runtime).
//   • It does NOT own `choice.response` (Io's IMMEDIATE reply, spoken
//     the instant the player taps a choice) — that also lives on the
//     sibling's `IoSecondPacketChoice.response`.
//   • It DOES own the FOLLOW-UP line Io speaks a beat after the reply
//     lands, pointing the player toward the Saint Orra door. This is
//     narratively distinct from `choice.response` — different function,
//     different rhythm (the reply acknowledges, the pointer redirects).
//
// Consumer contract (why this module isn't orphaned):
//   1. `aftersign/src/ioSecondPacketResponseVoice.test.ts` — pure-lane
//      check bundle asserting both choice ids produce distinct, non-empty
//      pointer lines, both name "Saint Orra" (the pointer's purpose),
//      unknown choice ids fall back to the accept path, the table is
//      frozen, and its keys match the sibling choice contract.
//   2. `aftersign/pure-runner.ts` — registers the check bundle in the
//      `test:aftersign:pure` lane, so CI reds on any drift.
//   3. `aftersign/main.js` — imports `ioSecondPacketResponseLine` at
//      the render site and hands the result to
//      `apps/web/src/aftersign/ioSecondPacketPointerRender.ts::stampIoSecondPacketPointer`.
//      Because the fallback returns a non-empty accept-path pointer
//      instead of an empty string, an unknown id still ships a
//      meaningful pointer paragraph (never a blank `<p>`).

import type { IoSecondPacketChoice } from './ioSecondPacketCopy.ts';

export type IoSecondPacketChoiceId = IoSecondPacketChoice['id'];

const SAINT_ORRA_POINTER: Readonly<Record<IoSecondPacketChoiceId, string>> = Object.freeze({
  'accept-second-packet':
    'Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.',
  'ask-what-changed':
    'The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.',
});

/**
 * Public alias — the frozen pointer table itself. Kept exported so the
 * contract test can assert freeze + key-parity against the sibling
 * choice contract without reaching into module internals.
 */
export const IO_SECOND_PACKET_RESPONSE_VOICE = SAINT_ORRA_POINTER;

/**
 * Return the Saint-Orra pointer line for a given second-packet
 * choice id. Unknown / non-string / missing input falls back to the
 * accept-path pointer — the beat still fires, it just uses the more
 * directive variant (matches the sibling copy's `guarded` default
 * philosophy). Never returns an empty string, so the render site
 * never stamps a blank `<p id="ioSecondPacketPointer">`.
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
