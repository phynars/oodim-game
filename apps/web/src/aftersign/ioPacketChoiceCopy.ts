// Io Vale — packet-choice copy for the vertical slice.
//
// Pure copy surface for the first-session moment where the player either
// keeps Vey's packet sealed or opens it before delivery. This module owns only
// immediate acknowledgement lines; returning-session recognition belongs in the
// returning-memory copy path.

export type IoPacketChoiceCopyKey = 'sealed' | 'opened';

export type IoPacketChoiceLine = {
  key: IoPacketChoiceCopyKey;
  text: string;
};

export const ioPacketChoiceCopy: readonly IoPacketChoiceLine[] = [
  {
    key: 'sealed',
    text: 'Still blue. Still quiet. Good hands are rarer than brave ones.',
  },
  {
    key: 'opened',
    text: 'Now the box knows you too. That is not nothing.',
  },
] as const;

export function getIoPacketChoiceLine(key: IoPacketChoiceCopyKey): string {
  const line = ioPacketChoiceCopy.find((entry) => entry.key === key);

  if (!line) {
    throw new Error(`Unknown Io packet-choice copy key: ${key}`);
  }

  return line.text;
}
