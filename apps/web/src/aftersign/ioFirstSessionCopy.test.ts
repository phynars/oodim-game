import { describe, expect, it } from 'vitest'

import {
  getIoFirstSessionLine,
  getIoFirstSessionText,
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

const forbiddenExposition = /memory system|persistent|durable|server/i

describe('Io first-session copy', () => {
  it('keeps the authored beat order stable for the slice', () => {
    expect(ioFirstSessionLines.map((entry) => entry.beat)).toEqual(expectedBeatOrder)
  })

  it('keeps every Io line short enough for phone dialogue UI', () => {
    for (const entry of ioFirstSessionLines) {
      expect(entry.line.length, entry.beat).toBeGreaterThan(0)
      // Io's authored lines run up to ~85 chars (see the route instruction
      // in docs/flagship/vertical-slice-script.md). The cap catches essays,
      // not scripture — keep it generous enough for the authored copy.
      expect(entry.line.length, entry.beat).toBeLessThanOrEqual(120)
    }
  })

  it('keeps Io from explaining the memory system out loud', () => {
    for (const entry of ioFirstSessionLines) {
      expect(entry.line, entry.beat).not.toMatch(forbiddenExposition)
    }
  })

  // Arrival is script-locked (vertical-slice-script.md §1); the harness
  // reads this exact string.
  it('locks the arrival line to the script verbatim', () => {
    expect(getIoFirstSessionText('arrival')).toBe(
      'You made it above the water. Good. That is the first qualification.',
    )
  })

  // The returning-session lines are the primary recognition proof.
  // vertical-slice-script.md §7 pins the fragments below; keep them stable.
  it('anchors return lines to the packet state the player caused', () => {
    expect(getIoFirstSessionText('returnSealed')).toMatch(/blue seal, unbroken/i)
    expect(getIoFirstSessionText('returnOpened')).toMatch(/^You came back\. The seal did not\./)
  })

  // referencedPlayerAction uses the same tokens as
  // docs/flagship/story-state-contract.md (delivery.outcome: 'sealed' | 'opened').
  it('tags every outcome-referencing beat with the matching action token', () => {
    expect(getIoFirstSessionLine('sealedWarning').referencedPlayerAction).toBe('sealed')
    expect(getIoFirstSessionLine('openedWarning').referencedPlayerAction).toBe('opened')
    expect(getIoFirstSessionLine('returnSealed').referencedPlayerAction).toBe('sealed')
    expect(getIoFirstSessionLine('returnOpened').referencedPlayerAction).toBe('opened')
  })

  it('throws on unknown beats so typos fail loud', () => {
    expect(() => getIoFirstSessionText('missing' as IoFirstSessionBeat)).toThrow(
      /Unknown Io first-session beat: missing/,
    )
  })
})
