export type IoFirstSessionBeat =
  | 'arrival'
  | 'packetOffer'
  | 'routeInstruction'
  | 'sealedWarning'
  | 'openedWarning'
  | 'returnSealed'
  | 'returnOpened'

export type IoFirstSessionLine = {
  beat: IoFirstSessionBeat
  line: string
}

export const ioFirstSessionLines: readonly IoFirstSessionLine[] = [
  {
    beat: 'arrival',
    line: 'You made it above the water. That is not the same as safe.',
  },
  {
    beat: 'packetOffer',
    line: 'Blue seal. Brass box. No names until it lands.',
  },
  {
    beat: 'routeInstruction',
    line: 'Follow the lanterns that hum. Ignore the ones that know your voice.',
  },
  {
    beat: 'sealedWarning',
    line: 'If it stays closed, I learn one thing about you.',
  },
  {
    beat: 'openedWarning',
    line: 'If it opens, I learn a different thing.',
  },
  {
    beat: 'returnSealed',
    line: 'Blue seal intact. Good. Vey needs hands that do not itch.',
  },
  {
    beat: 'returnOpened',
    line: 'Blue seal broken. Curiosity is a tool. So is a knife.',
  },
] as const

export function getIoFirstSessionLine(beat: IoFirstSessionBeat): string {
  return ioFirstSessionLines.find((entry) => entry.beat === beat)?.line ?? ''
}
