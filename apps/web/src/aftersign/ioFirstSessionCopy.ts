// Io Vale — first-session copy for the vertical slice.
//
// SOURCE OF TRUTH: docs/flagship/vertical-slice-script.md.
// The arrival line (§1) and returning-session recognition lines (§7)
// are SCRIPT-LOCKED — the harness reads these exact strings and the
// slice proof depends on Io naming the packet outcome the player caused.
// Do not paraphrase them here without updating the script in the same PR.
//
// `referencedPlayerAction` mirrors the story-state contract's
// packet outcome tokens ('sealed' | 'opened') so tests can assert that
// each outcome-referencing beat points at the right memory fact.

export type IoFirstSessionBeat =
  | 'arrival'
  | 'packetOffer'
  | 'routeInstruction'
  | 'sealedWarning'
  | 'openedWarning'
  | 'returnSealed'
  | 'returnOpened'

export type IoReferencedPlayerAction = 'sealed' | 'opened'

export type IoFirstSessionLine = {
  beat: IoFirstSessionBeat
  line: string
  /**
   * Which packet outcome this beat refers to, if any. Present on the
   * four beats whose text is anchored to a memory fact: the two
   * pre-delivery warnings and the two returning-session recognition
   * lines. Absent on beats that don't name a prior action.
   */
  referencedPlayerAction?: IoReferencedPlayerAction
}

export const ioFirstSessionLines: readonly IoFirstSessionLine[] = [
  {
    beat: 'arrival',
    // Script-locked — vertical-slice-script.md §1.
    line: 'You made it above the water. Good. That is the first qualification.',
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
    referencedPlayerAction: 'sealed',
  },
  {
    beat: 'openedWarning',
    line: 'If it opens, I learn a different thing.',
    referencedPlayerAction: 'opened',
  },
  {
    beat: 'returnSealed',
    // Script-locked — vertical-slice-script.md §7 (returning session).
    line: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    referencedPlayerAction: 'sealed',
  },
  {
    beat: 'returnOpened',
    // Script-locked — vertical-slice-script.md §7 (returning session).
    line: 'You came back. The seal did not. I can use one of those facts.',
    referencedPlayerAction: 'opened',
  },
] as const

export function getIoFirstSessionLine(beat: IoFirstSessionBeat): IoFirstSessionLine {
  const entry = ioFirstSessionLines.find((line) => line.beat === beat)
  if (!entry) {
    throw new Error(`Unknown Io first-session beat: ${beat}`)
  }
  return entry
}

export function getIoFirstSessionText(beat: IoFirstSessionBeat): string {
  return getIoFirstSessionLine(beat).line
}
