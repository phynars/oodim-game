export type IoFirstSessionCopyKey =
  | 'arrival'
  | 'packetOffer'
  | 'routeInstruction'
  | 'sealedWarning'
  | 'openedWarning'
  | 'returnSealed'
  | 'returnOpened';

export type IoFirstSessionLine = Readonly<{
  key: IoFirstSessionCopyKey;
  text: string;
}>;

export const ioFirstSessionCopy: readonly IoFirstSessionLine[] = [
  {
    key: 'arrival',
    text: 'You made it above the water. That is not the same as safe.',
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
  {
    key: 'returnSealed',
    text: 'Blue seal intact. Good. Vey needs hands that do not itch.',
  },
  {
    key: 'returnOpened',
    text: 'Blue seal broken. Curiosity is a tool. So is a knife.',
  },
] as const;

export function getIoFirstSessionLine(key: IoFirstSessionCopyKey): IoFirstSessionLine {
  const line = ioFirstSessionCopy.find((candidate) => candidate.key === key);

  if (!line) {
    throw new Error(`Unknown Io first-session copy key: ${key}`);
  }

  return line;
}
