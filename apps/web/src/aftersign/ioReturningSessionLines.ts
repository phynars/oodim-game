export type IoReturningSessionOutcome = 'sealed' | 'opened' | 'skipped-route' | 'listened-route'

export type IoReturningSessionLine = {
  outcome: IoReturningSessionOutcome
  line: string
  rememberedAction: string
}

export const ioReturningSessionLines: Record<IoReturningSessionOutcome, IoReturningSessionLine> = {
  sealed: {
    outcome: 'sealed',
    line: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    rememberedAction: 'delivered the first sealed packet unopened',
  },
  opened: {
    outcome: 'opened',
    line: 'You came back. The seal did not. I can use one of those facts.',
    rememberedAction: 'opened the first sealed packet before returning',
  },
  'skipped-route': {
    outcome: 'skipped-route',
    line: 'You found the box anyway. Next time, let me finish saving your life.',
    rememberedAction: "left before Io's route instructions finished",
  },
  'listened-route': {
    outcome: 'listened-route',
    line: 'You listened before you ran. Rare habit. Keep it.',
    rememberedAction: "listened to Io's route instructions before leaving",
  },
}

export function getIoReturningSessionLine(outcome: IoReturningSessionOutcome): IoReturningSessionLine {
  return ioReturningSessionLines[outcome]
}
