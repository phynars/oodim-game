// AFTERSIGN — Io Vale voice surface
// Runnable copy module for the served slice. Keep Io short, concrete, and useful.

export const IO_VOICE_RULES = Object.freeze({
  posture: 'calm, dry, ledger-minded',
  sentenceRule: 'one fact noticed, one consequence offered',
  forbiddenMoves: Object.freeze([
    'explaining the memory system',
    'generic affinity praise',
    'lore before action',
    'sentiment without a job attached',
  ]),
});

export const IO_LINES = Object.freeze({
  firstOffer: Object.freeze({
    id: 'io.firstOffer.safe-blue-packet',
    speaker: 'io',
    text: 'Blue packet. Pharmacy sign. Keep the seal whole and I learn something useful.',
    actionLabel: 'Take the blue packet',
  }),

  routeBrief: Object.freeze({
    id: 'io.routeBrief.silt-stair',
    speaker: 'io',
    text: 'Lantern stair is longer. Dark cut is faster. One of them keeps better records.',
    safeRouteLabel: 'Take the lantern stair',
    riskyRouteLabel: 'Take the dark cut',
  }),

  returnSealed: Object.freeze({
    id: 'io.return.sealed',
    speaker: 'io',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    nextJobLabel: 'Ask what that trust buys',
  }),

  returnOpened: Object.freeze({
    id: 'io.return.opened',
    speaker: 'io',
    text: 'You came back. The seal did not. I can use one of those facts.',
    nextJobLabel: 'Ask which fact still counts',
  }),

  nextJobTrusted: Object.freeze({
    id: 'io.nextJob.trusted',
    speaker: 'io',
    text: 'Orra owes me a name and hates paying clean couriers. Good. Take the stair with witnesses.',
    actionLabel: 'Take Orra’s clean job',
  }),

  nextJobDistrusted: Object.freeze({
    id: 'io.nextJob.distrusted',
    speaker: 'io',
    text: 'Orra still needs a courier. You still need a smaller secret. Carry the empty envelope first.',
    actionLabel: 'Take the empty-envelope job',
  }),
});

export function getIoReturnLine(packetOutcome) {
  return packetOutcome === 'opened' ? IO_LINES.returnOpened : IO_LINES.returnSealed;
}

export function getIoNextJobLine(packetOutcome) {
  return packetOutcome === 'opened' ? IO_LINES.nextJobDistrusted : IO_LINES.nextJobTrusted;
}
