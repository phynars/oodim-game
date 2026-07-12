import { describe, expect, it } from 'vitest'

import {
  getIoFirstSessionLine,
  ioFirstSessionLines,
  type IoFirstSessionBeat,
} from './ioFirstSessionCopy'

const expectedBeatOrder: readonly IoFirstSessionBeat[] = [
  'arrival',
  'packetOffer',
  'routeInstruction',
  'sealedWarning',
  'openedWarning',
  'returnSealed',
  'returnOpened',
]

const forbiddenExpositionWords = /\b(memory system|persistent|server-authoritative|durable|mechanic)\b/i

describe('Io first-session copy', () => {
  it('keeps the authored beat order stable for the slice', () => {
    expect(ioFirstSessionLines.map((entry) => entry.beat)).toEqual(expectedBeatOrder)
  })

  it('keeps every Io line short enough for phone dialogue UI', () => {
    for (const entry of ioFirstSessionLines) {
      expect(entry.line.length, entry.beat).toBeLessThanOrEqual(76)
    }
  })

  it('keeps Io from explaining the memory system out loud', () => {
    for (const entry of ioFirstSessionLines) {
      expect(entry.line, entry.beat).not.toMatch(forbiddenExpositionWords)
    }
  })

  it('looks up a line by beat', () => {
    expect(getIoFirstSessionLine('packetOffer')).toBe('Blue seal. Brass box. No names until it lands.')
  })

  it('anchors return lines to the packet state the player caused', () => {
    expect(getIoFirstSessionLine('returnSealed')).toMatch(/seal intact/i)
    expect(getIoFirstSessionLine('returnOpened')).toMatch(/seal broken/i)
  })
})
