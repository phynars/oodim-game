import { describe, expect, it } from 'vitest'
import { getIoReturningSessionLine, ioReturningSessionLines, type IoReturningSessionOutcome } from './ioReturningSessionLines'

const expectedLines: Record<IoReturningSessionOutcome, string> = {
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  'skipped-route': 'You found the box anyway. Next time, let me finish saving your life.',
  'listened-route': 'You listened before you ran. Rare habit. Keep it.',
}

describe('Io returning-session lines', () => {
  it('keeps every authored returning-session outcome wired to its exact line', () => {
    for (const [outcome, line] of Object.entries(expectedLines) as [IoReturningSessionOutcome, string][]) {
      expect(getIoReturningSessionLine(outcome).line).toBe(line)
    }
  })

  it('keeps every line tied to a concrete remembered player action', () => {
    for (const line of Object.values(ioReturningSessionLines)) {
      expect(line.rememberedAction).not.toHaveLength(0)
      expect(line.rememberedAction).not.toMatch(/trust \+\d/i)
    }
  })
})
