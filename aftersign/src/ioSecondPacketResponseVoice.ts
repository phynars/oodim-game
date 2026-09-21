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
// Consumer contract (why this module isn't orphaned — reviewer feedback
// on the prior draft was correct: an unconsumed file is dead on arrival):
//   1. `aftersign/src/ioSecondPacketResponseVoice.test.ts` — pure-lane
//      check bundle asserting both choice ids produce distinct, non-empty
//      pointer lines, both name "Saint Orra" (the pointer's purpose),
//      and unknown choice ids fall back to the accept path.
//   2. `aftersign/pure-runner.ts` — registers the check bundle in the
//      `test:aftersign:pure` lane, so CI reds on any drift.
//
// Render-site wire-in (PR #1874, addressing Soren's REQUEST_CHANGES):
//   3. `aftersign/main.js` — imports `ioSecondPacketResponseLine`
//      alongside the sibling `selectIoSecondPacketCopyForReturnReason`
//      and renders the accepted choice's transient pointer via
//      `apps/web/src/aftersign/ioSecondPacketPointerRender.ts::stampIoSecondPacketPointer`
//      into a `<p id="ioSecondPacketPointer">` sibling paragraph
//      right after `#line`, keyed on the two second-packet choice
//      ids (`accept-second-packet` / `ask-what-changed`). The
//      paragraph is a SIBLING, not a `#line` overwrite — the beat
//      dialogue table in `ioRecognitionDialogue.ts` still owns
//      `#line` (contract-pinned by
//      `io-phone-ready-look-sound-contract.spec.ts` on `lineText`).
//   4. `apps/web/src/aftersign/ioSecondPacketPointerRender.consumer.test.ts`
//      — jsdom-mount consumer test asserting the writer inserts the
//      sibling paragraph, matches the exact pointer literal for each
//      choice id, and does not overwrite `#line` textContent.
//   5. `aftersign/e2e/io-second-packet-response-pointer-served.spec.ts`
//      — tap-driven Playwright spec that plays a phone viewport from
//      packet-offered through `io-next-job`, then taps the two
//      second-packet buttons and asserts the rendered pointer text +
//      `data-aftersign-io-second-packet-pointer="<choiceId>"` land on
//      the shipped `#ioSecondPacketPointer` element.

import type { IoSecondPacketChoice } from './ioSecondPacketCopy.ts';

export type IoSecondPacketChoiceId = IoSecondPacketChoice['id'];

const SAINT_ORRA_POINTER: Readonly<Record<IoSecondPacketChoiceId, string>> = Object.freeze({
  'accept-second-packet':
    'Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.',
  'ask-what-changed':
    'The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.',
});

export const IO_SECOND_PACKET_RESPONSE_VOICE = SAINT_ORRA_POINTER;

/**
 * Return the Saint-Orra pointer line for a given second-packet
 * choice id. Unknown / non-string input falls back to the accept-path
 * pointer — the beat still fires, it just uses the more directive
 * variant (matches the sibling copy's `guarded` default philosophy).
 */
export function ioSecondPacketResponseLine(choiceId: unknown): string {
  if (typeof choiceId === 'string'
    && Object.prototype.hasOwnProperty.call(SAINT_ORRA_POINTER, choiceId)) {
    return SAINT_ORRA_POINTER[choiceId as IoSecondPacketChoiceId];
  }
  return SAINT_ORRA_POINTER['accept-second-packet'];
}
