import { describe, expect, it } from 'vitest'

import { getIoReturningSessionLine } from '../../../../packages/aftersign/src/ioReturningSession'
import {
  getIoReturningSessionMemoryLine,
  getIoRouteMemoryLine,
  IO_RETURNING_SESSION_LINES,
  IO_ROUTE_MEMORY_LINES,
} from './ioReturningSessionLines'

// Parity guard: the web view MUST NOT redeclare Io's line strings. Every
// `text` field has to equal the shared-package authority verbatim, or the
// single-source contract is broken. If this drifts, fix the web view —
// never paraphrase the package.
describe('Io returning-session lines (web view sources from package)', () => {
  it('sources sealed packet text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_LINES.sealed.text).toBe(
      getIoReturningSessionLine('sealedPacket'),
    )
  })

  it('sources opened packet text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_LINES.opened.text).toBe(
      getIoReturningSessionLine('openedPacket'),
    )
  })

  it('sources listened route text from the aftersign package', () => {
    expect(IO_ROUTE_MEMORY_LINES.listened.text).toBe(
      getIoReturningSessionLine('listenedRoute'),
    )
  })

  it('sources skipped route text from the aftersign package', () => {
    expect(IO_ROUTE_MEMORY_LINES.skipped.text).toBe(
      getIoReturningSessionLine('skippedRoute'),
    )
  })

  it('anchors each memory to a concrete remembered player action (not trust deltas)', () => {
    const all = [
      ...Object.values(IO_RETURNING_SESSION_LINES),
      ...Object.values(IO_ROUTE_MEMORY_LINES),
    ]
    for (const memory of all) {
      expect(memory.rememberedAction).not.toHaveLength(0)
      expect(memory.rememberedAction).not.toMatch(/trust \+\d/i)
    }
  })

  it('resolves a packet outcome to the decorated memory record', () => {
    expect(getIoReturningSessionMemoryLine({ packetOutcome: 'sealed' })).toBe(
      IO_RETURNING_SESSION_LINES.sealed,
    )
    expect(getIoReturningSessionMemoryLine({ packetOutcome: 'opened' })).toBe(
      IO_RETURNING_SESSION_LINES.opened,
    )
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
