import { describe, expect, it } from 'vitest'

import {
  getIoReturningSessionLine,
  getIoRouteMemoryLine,
  IO_RETURNING_SESSION_LINES,
  IO_ROUTE_MEMORY_LINES,
} from './ioReturningSessionLines'

describe('Io returning-session memory lines', () => {
  it('references the sealed packet outcome with a concrete remembered action', () => {
    const line = getIoReturningSessionLine({ packetOutcome: 'sealed' })

    expect(line).toBe(IO_RETURNING_SESSION_LINES.sealed)
    expect(line.rememberedAction).toContain('seal unbroken')
    expect(line.text).toBe(
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    )
  })

  it('references the opened packet outcome with a concrete remembered action', () => {
    const line = getIoReturningSessionLine({ packetOutcome: 'opened' })

    expect(line).toBe(IO_RETURNING_SESSION_LINES.opened)
    expect(line.rememberedAction).toContain('opened')
    expect(line.text).toBe('You came back. The seal did not. I can use one of those facts.')
  })

  it('keeps optional route-instruction memories separate from packet outcome', () => {
    expect(getIoRouteMemoryLine({ packetOutcome: 'sealed' })).toBeUndefined()
    expect(
      getIoRouteMemoryLine({ packetOutcome: 'sealed', routeInstructionBehavior: 'listened' }),
    ).toBe(IO_ROUTE_MEMORY_LINES.listened)
    expect(
      getIoRouteMemoryLine({ packetOutcome: 'opened', routeInstructionBehavior: 'skipped' }),
    ).toBe(IO_ROUTE_MEMORY_LINES.skipped)
  })
})
