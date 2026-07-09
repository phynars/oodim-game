import { describe, expect, it } from 'vitest'

import {
  assertPacketIntentFeelContract,
  DEFAULT_PACKET_INTENT_CONFIG,
  resolvePacketIntent,
} from './packetIntent'

describe('resolvePacketIntent', () => {
  it('keeps a quick tap sealed instead of treating packet opening as menu trivia', () => {
    const result = resolvePacketIntent([
      { type: 'press-start', t: 1_000, x: 120, y: 220 },
      { type: 'press-end', t: 1_120, x: 121, y: 221 },
    ])

    expect(result.action).toBe('keep-sealed')
    expect(result.sealState).toBe('sealed')
    expect(result.cancelled).toBe(false)
    expect(result.elapsedMs).toBe(120)
  })

  it('opens the seal only after the deliberate hold threshold', () => {
    const holdMs = DEFAULT_PACKET_INTENT_CONFIG.openHoldMs

    const almost = resolvePacketIntent([
      { type: 'press-start', t: 2_000, x: 80, y: 90 },
      { type: 'press-end', t: 2_000 + holdMs - 1, x: 82, y: 92 },
    ])
    const opened = resolvePacketIntent([
      { type: 'press-start', t: 2_000, x: 80, y: 90 },
      { type: 'press-end', t: 2_000 + holdMs, x: 82, y: 92 },
    ])

    expect(almost.action).toBe('keep-sealed')
    expect(almost.sealState).toBe('sealed')
    expect(almost.cancelled).toBe(false)

    expect(opened.action).toBe('open')
    expect(opened.sealState).toBe('opened')
    expect(opened.cancelled).toBe(false)
    expect(opened.elapsedMs).toBe(holdMs)
  })

  it('cancels an open hold when thumb drift leaves the interaction radius', () => {
    const drift = DEFAULT_PACKET_INTENT_CONFIG.cancelRadiusPx + 1

    const result = resolvePacketIntent([
      { type: 'press-start', t: 5_000, x: 10, y: 10 },
      { type: 'move', t: 5_200, x: 10 + drift, y: 10 },
      { type: 'press-end', t: 5_600, x: 10 + drift, y: 10 },
    ])

    expect(result.action).toBe('keep-sealed')
    expect(result.sealState).toBe('sealed')
    expect(result.cancelled).toBe(true)
  })

  it('treats an explicit cancel event as a preserved seal', () => {
    const result = resolvePacketIntent([
      { type: 'press-start', t: 0, x: 4, y: 4 },
      { type: 'cancel', t: 200 },
    ])

    expect(result.action).toBe('keep-sealed')
    expect(result.sealState).toBe('sealed')
    expect(result.cancelled).toBe(true)
  })

  it('returns a sealed result when no press-start is present', () => {
    const result = resolvePacketIntent([{ type: 'cancel', t: 0 }])

    expect(result.action).toBe('keep-sealed')
    expect(result.sealState).toBe('sealed')
    expect(result.cancelled).toBe(true)
    expect(result.elapsedMs).toBe(0)
  })
})

describe('assertPacketIntentFeelContract', () => {
  it('passes with the default config', () => {
    expect(() => assertPacketIntentFeelContract()).not.toThrow()
  })
})
