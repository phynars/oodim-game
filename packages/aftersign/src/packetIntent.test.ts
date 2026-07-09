import { describe, expect, it } from 'vitest'

import {
  beginPacketOpenIntent,
  createPacketIntentState,
  DEFAULT_PACKET_INTENT_CONFIG,
  endPacketOpenIntent,
  keepPacketSealed,
  PACKET_INTENT_HARNESS_CONTRACT,
  snapshotPacketIntent,
  updatePacketOpenIntent,
} from './packetIntent'

describe('packet open intent', () => {
  it('keeps a quick tap sealed instead of treating packet opening as menu trivia', () => {
    const started = beginPacketOpenIntent(createPacketIntentState(), 7, 120, 220, 1_000)
    const released = endPacketOpenIntent(
      updatePacketOpenIntent(started, 7, 121, 221, 1_000 + PACKET_INTENT_HARNESS_CONTRACT.sealedTapMaxMs),
      7,
    )

    expect(released.choice).toBe('sealed')
    expect(released.phase).toBe('idle')
    expect(released.progress).toBe(0)
  })

  it('commits opening only after the deliberate hold threshold', () => {
    const started = beginPacketOpenIntent(createPacketIntentState(), 3, 80, 90, 2_000)
    const almost = updatePacketOpenIntent(
      started,
      3,
      82,
      92,
      2_000 + DEFAULT_PACKET_INTENT_CONFIG.openHoldMs - 1,
    )
    const opened = updatePacketOpenIntent(
      almost,
      3,
      82,
      92,
      2_000 + DEFAULT_PACKET_INTENT_CONFIG.openHoldMs,
    )

    expect(almost.choice).toBe('sealed')
    expect(almost.phase).toBe('pressing')
    expect(almost.progress).toBeLessThan(1)
    expect(opened.choice).toBe('opened')
    expect(opened.phase).toBe('committed')
    expect(opened.progress).toBe(1)
  })

  it('cancels an open hold when thumb drift leaves the interaction radius', () => {
    const started = beginPacketOpenIntent(createPacketIntentState(), 2, 10, 10, 5_000)
    const cancelled = updatePacketOpenIntent(
      started,
      2,
      10 + PACKET_INTENT_HARNESS_CONTRACT.cancelRadiusPx + 1,
      10,
      5_200,
    )

    expect(cancelled.choice).toBe('sealed')
    expect(cancelled.phase).toBe('cancelled')
    expect(cancelled.progress).toBe(0)
  })

  it('exposes feedback only after progress is visible enough to read', () => {
    const started = beginPacketOpenIntent(createPacketIntentState(), 9, 0, 0, 10_000)
    const hidden = updatePacketOpenIntent(started, 9, 0, 0, 10_000 + 10)
    const visible = updatePacketOpenIntent(started, 9, 0, 0, 10_000 + 120)

    expect(snapshotPacketIntent(hidden).shouldShowFeedback).toBe(false)
    expect(snapshotPacketIntent(visible).shouldShowFeedback).toBe(true)
  })

  it('lets preserving the packet become an explicit committed choice', () => {
    const committed = keepPacketSealed(beginPacketOpenIntent(createPacketIntentState(), 1, 4, 4, 0))

    expect(committed.choice).toBe('sealed')
    expect(committed.phase).toBe('committed')
    expect(committed.pointerId).toBeNull()
  })
})
