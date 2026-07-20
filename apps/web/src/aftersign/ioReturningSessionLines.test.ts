import { describe, expect, it } from 'vitest'

import { getIoReturningSessionLine } from '../../../../packages/aftersign/src/ioReturningSession'
import {
  getIoReturningSessionMemoryLine,
  IO_BARE_RETURN_LINE,
  getIoReturningSessionRecognitionLines,
  getIoReturnPostureLine,
  getIoRouteMemoryLine,
  IO_RETURN_POSTURE_LINES,
  IO_RETURNING_SESSION_CHAINED_LINES,
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

  it('sources sealed+listened chained text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_CHAINED_LINES.sealedPacketListenedRoute.text).toBe(
      getIoReturningSessionLine('sealedPacketListenedRoute'),
    )
  })

  it('sources sealed+skipped chained text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_CHAINED_LINES.sealedPacketSkippedRoute.text).toBe(
      getIoReturningSessionLine('sealedPacketSkippedRoute'),
    )
  })

  it('sources opened+listened chained text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_CHAINED_LINES.openedPacketListenedRoute.text).toBe(
      getIoReturningSessionLine('openedPacketListenedRoute'),
    )
  })

  it('sources opened+skipped chained text from the aftersign package', () => {
    expect(IO_RETURNING_SESSION_CHAINED_LINES.openedPacketSkippedRoute.text).toBe(
      getIoReturningSessionLine('openedPacketSkippedRoute'),
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

  it('sources kind posture text from the aftersign package', () => {
    expect(IO_RETURN_POSTURE_LINES.kind.text).toBe(
      getIoReturningSessionLine('kindReturn'),
    )
  })

  it('sources evasive posture text from the aftersign package', () => {
    expect(IO_RETURN_POSTURE_LINES.evasive.text).toBe(
      getIoReturningSessionLine('evasiveReturn'),
    )
  })

  it('sources blunt posture text from the aftersign package', () => {
    expect(IO_RETURN_POSTURE_LINES.blunt.text).toBe(
      getIoReturningSessionLine('bluntReturn'),
    )
  })

  it('anchors each memory to a concrete remembered player action (not trust deltas)', () => {
    const all = [
      ...Object.values(IO_RETURNING_SESSION_LINES),
      ...Object.values(IO_ROUTE_MEMORY_LINES),
      ...Object.values(IO_RETURN_POSTURE_LINES),
    ]
    for (const memory of all) {
      expect(memory.rememberedAction).not.toHaveLength(0)
      expect(memory.rememberedAction).not.toMatch(/trust \+\d/i)
    }
  })

  it('keeps every recognition-line id stable and unique', () => {
    const all = [
      ...Object.values(IO_RETURNING_SESSION_LINES),
      ...Object.values(IO_ROUTE_MEMORY_LINES),
      ...Object.values(IO_RETURN_POSTURE_LINES),
    ]
    const ids = all.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves a packet outcome to the decorated memory record', () => {
    expect(getIoReturningSessionMemoryLine({ packetOutcome: 'sealed' })).toBe(
      IO_RETURNING_SESSION_LINES.sealed,
    )
    expect(getIoReturningSessionMemoryLine({ packetOutcome: 'opened' })).toBe(
      IO_RETURNING_SESSION_LINES.opened,
    )
  })

  it('keeps optional route-instruction memories available as standalone follow-up lines', () => {
    expect(getIoRouteMemoryLine({ packetOutcome: 'sealed' })).toBeUndefined()
    expect(
      getIoRouteMemoryLine({ packetOutcome: 'sealed', routeInstructionBehavior: 'listened' }),
    ).toBe(IO_ROUTE_MEMORY_LINES.listened)
    expect(
      getIoRouteMemoryLine({ packetOutcome: 'opened', routeInstructionBehavior: 'skipped' }),
    ).toBe(IO_ROUTE_MEMORY_LINES.skipped)
  })

  it('exposes posture as an optional third beat, never a substitute', () => {
    expect(getIoReturnPostureLine({ packetOutcome: 'sealed' })).toBeUndefined()
    expect(
      getIoReturnPostureLine({ packetOutcome: 'sealed', returnAnswerTone: 'evasive' }),
    ).toBe(IO_RETURN_POSTURE_LINES.evasive)
  })

  it('assembles the full recognition surface: chained packet+route line, then posture', () => {
    expect(
      getIoReturningSessionRecognitionLines({
        packetOutcome: 'sealed',
        routeInstructionBehavior: 'listened',
        returnAnswerTone: 'evasive',
      }),
    ).toEqual([
      IO_RETURNING_SESSION_CHAINED_LINES.sealedPacketListenedRoute,
      IO_RETURN_POSTURE_LINES.evasive,
    ])
  })

  it('returns only the packet line when no route or posture is remembered', () => {
    expect(
      getIoReturningSessionRecognitionLines({ packetOutcome: 'opened' }),
    ).toEqual([IO_RETURNING_SESSION_LINES.opened])
  })

  it('returns the chained line when packet outcome and route memory are both present', () => {
    expect(
      getIoReturningSessionMemoryLine({
        packetOutcome: 'sealed',
        routeInstructionBehavior: 'skipped',
      }),
    ).toBe(IO_RETURNING_SESSION_CHAINED_LINES.sealedPacketSkippedRoute)

    expect(
      getIoReturningSessionMemoryLine({
        packetOutcome: 'opened',
        routeInstructionBehavior: 'listened',
      }),
    ).toBe(IO_RETURNING_SESSION_CHAINED_LINES.openedPacketListenedRoute)
  })
})
