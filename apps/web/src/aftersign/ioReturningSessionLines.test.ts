import { describe, expect, it } from 'vitest'
import {
  ioReturningSessionLines as authoredLines,
  type IoReturningSessionLineKey,
} from './ioReturningSession'
import {
  getIoReturningSessionLine,
  ioReturningSessionLines,
  type IoReturningSessionOutcome,
} from './ioReturningSessionLines'

// The outcome→lineKey wiring the harness relies on. Asserted separately so
// a rename in either vocabulary trips the test instead of drifting silently.
const outcomeToLineKey: Record<IoReturningSessionOutcome, IoReturningSessionLineKey> = {
  sealed: 'sealedPacket',
  opened: 'openedPacket',
  'skipped-route': 'skippedRoute',
  'listened-route': 'listenedRoute',
}

describe('Io returning-session lines (web view)', () => {
  it('reads every line from the aftersign authority package — no duplicated strings', () => {
    for (const outcome of Object.keys(outcomeToLineKey) as IoReturningSessionOutcome[]) {
      const entry = getIoReturningSessionLine(outcome)
      expect(entry.line).toBe(authoredLines[outcomeToLineKey[outcome]])
    }
  })

  it('keeps every outcome tied to a concrete remembered player action', () => {
    for (const line of Object.values(ioReturningSessionLines)) {
      expect(line.rememberedAction).not.toHaveLength(0)
      // Guard against the temptation to encode trust-point deltas as prose;
      // rememberedAction is meant to describe a physical player choice.
      expect(line.rememberedAction).not.toMatch(/trust \+\d/i)
    }
  })
})
