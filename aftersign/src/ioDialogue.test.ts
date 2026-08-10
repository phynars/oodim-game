import assert from 'node:assert/strict'
import { buildIoReturnLines } from './ioDialogue.ts'

assert.deepEqual(buildIoReturnLines({ packetOutcome: 'sealed' }), [
  'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
])

assert.deepEqual(buildIoReturnLines({ packetOutcome: 'opened' }), [
  'You came back. The seal did not. I can use one of those facts.',
])

assert.deepEqual(
  buildIoReturnLines({
    packetOutcome: 'sealed',
    routeAttention: 'listened',
    returnTone: 'blunt',
  }),
  [
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    'You listened before you ran. Rare habit. Keep it.',
    'Blunt answer. Saves ink. Sometimes blood.',
  ],
)

assert.deepEqual(
  buildIoReturnLines({
    packetOutcome: 'opened',
    routeAttention: 'skipped',
    returnTone: 'evasive',
  }),
  [
    'You came back. The seal did not. I can use one of those facts.',
    'You found the box anyway. Next time, let me finish saving your life.',
    'You dodged the question. Fine. Couriers survive on light feet.',
  ],
)
