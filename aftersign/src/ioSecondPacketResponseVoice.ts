// Io's Saint-Orra pointer line, spoken after a second-packet choice.
// This module owns the follow-up line; the choice pair remains in
// `ioSecondPacketCopy.ts`.

import type { IoSecondPacketChoice } from './ioSecondPacketCopy.ts';

export type IoSecondPacketChoiceId = IoSecondPacketChoice['id'];

const SAINT_ORRA_POINTER: Readonly<Record<IoSecondPacketChoiceId, string>> = Object.freeze({
  'accept-second-packet':
    'Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.',
  'ask-what-changed':
    'The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.',
});

/** Frozen pointer copy keyed to the second-packet choice id. */
export const IO_SECOND_PACKET_RESPONSE_VOICE = SAINT_ORRA_POINTER;

/**
 * Return Io's Saint-Orra pointer for a second-packet choice. Malformed or
 * unknown ids take the directive accept-path fallback so a renderer never
 * receives an empty line.
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
