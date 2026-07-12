import { describe, expect, it } from 'vitest'

type AftersignNpcMemoryHarness = {
  playerId: string
  npcId: string
  priorSessionFacts: string[]
  lastLine: string
  save: () => unknown
  load: (snapshot: unknown) => void
}

type AftersignGameHarness = {
  npcMemory?: Partial<AftersignNpcMemoryHarness>
}

const requiredPriorSessionFact = 'player-returned-after-prior-session'

function readAftersignHarnessSurface(): AftersignGameHarness | undefined {
  const globalHarness = globalThis as typeof globalThis & {
    __game?: AftersignGameHarness
    window?: Window & { __game?: AftersignGameHarness }
  }

  return globalHarness.window?.__game ?? globalHarness.__game
}

describe('AFTERSIGN NPC memory round-trip harness contract', () => {
  it('exposes Io recalling a prior session through window.__game and durable save/load', () => {
    const game = readAftersignHarnessSurface()

    expect(game, 'AFTERSIGN must expose window.__game for story/state harness assertions').toBeDefined()
    expect(game?.npcMemory, 'window.__game.npcMemory must expose the returning-NPC memory surface').toBeDefined()

    const npcMemory = game?.npcMemory

    expect(npcMemory?.playerId, 'npcMemory.playerId must identify the durable returning player').toEqual(
      expect.any(String),
    )
    expect(npcMemory?.playerId).not.toHaveLength(0)
    expect(npcMemory?.npcId, 'npcMemory.npcId must identify the remembering NPC').toBe('io')
    expect(
      npcMemory?.priorSessionFacts,
      'Io must receive the persisted prior-session fact before choosing the returning line',
    ).toContain(requiredPriorSessionFact)
    expect(
      npcMemory?.lastLine,
      'Io must visibly reference the prior session; stored facts alone are not a story beat',
    ).toContain(requiredPriorSessionFact)

    expect(npcMemory?.save, 'npcMemory.save must expose the durable memory snapshot for the harness').toEqual(
      expect.any(Function),
    )
    expect(npcMemory?.load, 'npcMemory.load must restore the durable memory snapshot for the harness').toEqual(
      expect.any(Function),
    )

    const snapshot = npcMemory?.save?.()

    expect(snapshot, 'save() must return a serializable memory snapshot').toBeDefined()

    npcMemory?.load?.(snapshot)

    expect(
      npcMemory?.priorSessionFacts,
      'load(save()) must preserve the recalled prior-session fact',
    ).toContain(requiredPriorSessionFact)
    expect(npcMemory?.lastLine, 'load(save()) must preserve the visible returning-session reference').toContain(
      requiredPriorSessionFact,
    )
  })
})
