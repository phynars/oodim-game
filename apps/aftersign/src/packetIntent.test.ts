import { describe, expect, it } from 'vitest'
import {
  PACKET_OPEN_HOLD_MS,
  createPacketIntentState,
  getPacketOpenProgress,
  updatePacketIntent,
} from './packetIntent'

describe('packet opening intent', () => {
  it('keeps the blue packet sealed while the player only inspects it', () => {
    const state = updatePacketIntent(createPacketIntentState(), {
      inspecting: true,
      primaryHeld: false,
      dtMs: 16,
    })

    expect(state.sealState).toBe('sealed')
    expect(state.cue).toBe('inspect-held')
    expect(getPacketOpenProgress(state)).toBe(0)
  })

  it('requires a deliberate hold before opening the seal', () => {
    let state = createPacketIntentState()

    state = updatePacketIntent(state, {
      inspecting: true,
      primaryHeld: true,
      dtMs: PACKET_OPEN_HOLD_MS - 16,
    })

    expect(state.sealState).toBe('sealed')
    expect(state.cue).toBe('hold-to-open')
    expect(getPacketOpenProgress(state)).toBeCloseTo((PACKET_OPEN_HOLD_MS - 16) / PACKET_OPEN_HOLD_MS)

    state = updatePacketIntent(state, {
      inspecting: true,
      primaryHeld: true,
      dtMs: 16,
    })

    expect(state.sealState).toBe('opened')
    expect(state.cue).toBe('opened')
    expect(getPacketOpenProgress(state)).toBe(1)
  })

  it('cancels partial opening when the player releases before the hold completes', () => {
    let state = createPacketIntentState()

    state = updatePacketIntent(state, {
      inspecting: true,
      primaryHeld: true,
      dtMs: 120,
    })

    state = updatePacketIntent(state, {
      inspecting: true,
      primaryHeld: false,
      dtMs: 16,
    })

    expect(state.sealState).toBe('sealed')
    expect(state.cue).toBe('release-cancel')
    expect(state.holdMs).toBe(0)
    expect(getPacketOpenProgress(state)).toBe(0)
  })

  it('does not let background frame time open the packet when the player is not inspecting it', () => {
    let state = createPacketIntentState()

    state = updatePacketIntent(state, {
      inspecting: false,
      primaryHeld: true,
      dtMs: PACKET_OPEN_HOLD_MS * 2,
    })

    expect(state.sealState).toBe('sealed')
    expect(state.cue).toBe('idle')
    expect(state.holdMs).toBe(0)
  })
})
