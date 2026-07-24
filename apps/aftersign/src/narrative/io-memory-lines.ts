export type IoPacketOutcome = 'sealed' | 'opened'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnAnswerTone = 'kind' | 'evasive' | 'blunt'
export type IoLastSeenBucket = 'same-night' | 'next-night' | 'long-after'

export type IoMemoryBeat =
  | {
      kind: 'packet-outcome'
      outcome: IoPacketOutcome
    }
  | {
      kind: 'route-attention'
      attention: IoRouteAttention
    }
  | {
      kind: 'return-answer-tone'
      tone: IoReturnAnswerTone
    }
  | {
      kind: 'return-gap'
      bucket: IoLastSeenBucket
    }

export type IoMemoryLine = {
  id: string
  speaker: 'io'
  beat: IoMemoryBeat
  text: string
}

export const IO_MEMORY_LINES: readonly IoMemoryLine[] = [
  {
    id: 'io.return.packet.sealed.v1',
    speaker: 'io',
    beat: { kind: 'packet-outcome', outcome: 'sealed' },
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  {
    id: 'io.return.packet.opened.v1',
    speaker: 'io',
    beat: { kind: 'packet-outcome', outcome: 'opened' },
    text: 'You came back. The seal did not. I can use one of those facts.',
  },
  {
    id: 'io.return.route.listened.v1',
    speaker: 'io',
    beat: { kind: 'route-attention', attention: 'listened' },
    text: 'You listened before you ran. Rare habit. Keep it.',
  },
  {
    id: 'io.return.route.skipped.v1',
    speaker: 'io',
    beat: { kind: 'route-attention', attention: 'skipped' },
    text: 'You found the box anyway. Next time, let me finish saving your life.',
  },
  {
    id: 'io.return.tone.kind.v1',
    speaker: 'io',
    beat: { kind: 'return-answer-tone', tone: 'kind' },
    text: 'Kind answer. Not always useful. Not useless either.',
  },
  {
    id: 'io.return.tone.evasive.v1',
    speaker: 'io',
    beat: { kind: 'return-answer-tone', tone: 'evasive' },
    text: 'You dodged the question. Fine. Couriers survive by keeping one hand closed.',
  },
  {
    id: 'io.return.tone.blunt.v1',
    speaker: 'io',
    beat: { kind: 'return-answer-tone', tone: 'blunt' },
    text: 'Blunt answer. Saves time. Costs friends. We will budget for both.',
  },
  {
    id: 'io.return.gap.same-night.v1',
    speaker: 'io',
    beat: { kind: 'return-gap', bucket: 'same-night' },
    text: 'Back already. Good. The rain had not finished deciding about you.',
  },
  {
    id: 'io.return.gap.next-night.v1',
    speaker: 'io',
    beat: { kind: 'return-gap', bucket: 'next-night' },
    text: 'A night away, then back. That counts as a route, if not a promise.',
  },
  {
    id: 'io.return.gap.long-after.v1',
    speaker: 'io',
    beat: { kind: 'return-gap', bucket: 'long-after' },
    text: 'Long gap. The city kept your place open. I argued with it, but here we are.',
  },
] as const

export function getIoMemoryLine(beat: IoMemoryBeat): IoMemoryLine {
  const line = IO_MEMORY_LINES.find((candidate) => matchesIoMemoryBeat(candidate.beat, beat))

  if (!line) {
    throw new Error(`Missing Io memory line for ${JSON.stringify(beat)}`)
  }

  return line
}

function matchesIoMemoryBeat(left: IoMemoryBeat, right: IoMemoryBeat): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  switch (left.kind) {
    case 'packet-outcome':
      return right.kind === 'packet-outcome' && left.outcome === right.outcome
    case 'route-attention':
      return right.kind === 'route-attention' && left.attention === right.attention
    case 'return-answer-tone':
      return right.kind === 'return-answer-tone' && left.tone === right.tone
    case 'return-gap':
      return right.kind === 'return-gap' && left.bucket === right.bucket
  }
}
