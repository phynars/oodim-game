// Io Vale — FIRST-session copy for the vertical slice.
//
// This module owns only the beats Io speaks on the player's FIRST arrival.
// Returning-session recognition lines (§7 of the vertical-slice script) live
// in `packages/aftersign/src/ioReturningSession.ts` — that module is the
// single source of truth for anything a returning player hears. Do not
// re-add returnSealed / returnOpened here; the harness reads those from
// ioReturningSessionLines and duplicating the copy is a regression.

export type IoFirstSessionCopyKey =
  | 'arrival'
  | 'packetOffer'
  | 'routeInstruction'
  | 'sealedWarning'
  | 'openedWarning';

export type IoFirstSessionLine = {
  key: IoFirstSessionCopyKey;
  text: string;
};

export const ioFirstSessionCopy: readonly IoFirstSessionLine[] = [
  {
    key: 'arrival',
    // Script-locked — docs/flagship/vertical-slice-script.md §1.
    text: 'You made it above the water. Good. That is the first qualification.',
  },
  {
    key: 'packetOffer',
    text: 'Blue seal. Brass box. No names until it lands.',
  },
  {
    key: 'routeInstruction',
    text: 'Follow the lanterns that hum. Ignore the ones that know your voice.',
  },
  {
    key: 'sealedWarning',
    text: 'If it stays closed, I learn one thing about you.',
  },
  {
    key: 'openedWarning',
    text: 'If it opens, I learn a different thing.',
  },
] as const;

export function getIoFirstSessionLine(key: IoFirstSessionCopyKey): string {
  const line = ioFirstSessionCopy.find((entry) => entry.key === key);

  if (!line) {
    throw new Error(`Unknown Io first-session copy key: ${key}`);
  }

  return line.text;
}
