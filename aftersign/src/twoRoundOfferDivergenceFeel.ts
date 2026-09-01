export type PacketOutcome = 'sealed' | 'opened'

export type TrustPosture = 'firstRun' | 'trusted' | 'opened'

export interface CourierMemoryRecord {
  readonly completedDeliveryIds: readonly string[]
  readonly packetOutcome?: PacketOutcome
  readonly returnedToIo: boolean
}

export interface JobOffer {
  readonly id: string
  readonly label: string
  readonly risk: 'safe' | 'strange'
}

export interface TwoRoundOfferDivergenceResult {
  readonly firstRoundOfferIds: readonly string[]
  readonly secondRoundOfferIds: readonly string[]
  readonly changedOfferIds: readonly string[]
  readonly firstRoundPrimaryAction: string
  readonly secondRoundPrimaryAction: string
}

export function trustPostureForMemory(memory: CourierMemoryRecord): TrustPosture {
  if (memory.packetOutcome === 'opened') return 'opened'
  if (memory.returnedToIo && memory.packetOutcome === 'sealed') return 'trusted'
  return 'firstRun'
}

export function visibleJobOffersForMemory(memory: CourierMemoryRecord): readonly JobOffer[] {
  const posture = trustPostureForMemory(memory)

  if (posture === 'trusted') {
    return [
      {
        id: 'job-offer-bell-archive-name',
        label: 'Carry the bell-name to the archive',
        risk: 'strange',
      },
      {
        id: 'job-offer-silt-stair-ledger',
        label: 'Run the safe ledger back through the stair',
        risk: 'safe',
      },
    ]
  }

  if (posture === 'opened') {
    return [
      {
        id: 'job-offer-silt-stair-ledger',
        label: 'Run the safe ledger back through the stair',
        risk: 'safe',
      },
      {
        id: 'job-offer-unsealed-packet-repair',
        label: 'Repair the opened packet before the rain finds it',
        risk: 'strange',
      },
    ]
  }

  return [
    {
      id: 'job-offer-blue-packet',
      label: 'Take the sealed blue packet',
      risk: 'safe',
    },
  ]
}

export function evaluateTwoRoundOfferDivergence(
  firstRoundMemory: CourierMemoryRecord,
  secondRoundMemory: CourierMemoryRecord,
): TwoRoundOfferDivergenceResult {
  const firstRoundOfferIds = visibleJobOffersForMemory(firstRoundMemory).map((offer) => offer.id)
  const secondRoundOfferIds = visibleJobOffersForMemory(secondRoundMemory).map((offer) => offer.id)
  const changedOfferIds = secondRoundOfferIds.filter((id) => !firstRoundOfferIds.includes(id))

  return {
    firstRoundOfferIds,
    secondRoundOfferIds,
    changedOfferIds,
    firstRoundPrimaryAction: firstRoundOfferIds[0] ?? '',
    secondRoundPrimaryAction: secondRoundOfferIds[0] ?? '',
  }
}

export function assertTwoRoundOfferDiverges(result: TwoRoundOfferDivergenceResult): void {
  if (result.firstRoundOfferIds.length === 0) {
    throw new Error('Expected first round to expose at least one tappable job offer')
  }

  if (result.secondRoundOfferIds.length === 0) {
    throw new Error('Expected second round to expose at least one tappable job offer')
  }

  if (result.firstRoundPrimaryAction === result.secondRoundPrimaryAction) {
    throw new Error(
      `Expected the second round primary action to diverge; both rounds exposed ${result.firstRoundPrimaryAction}`,
    )
  }

  if (result.changedOfferIds.length === 0) {
    throw new Error('Expected the second round to add at least one visibly different job offer')
  }
}

export function runTwoRoundOfferDivergenceChecks(): void {
  const firstRun: CourierMemoryRecord = {
    completedDeliveryIds: [],
    returnedToIo: false,
  }

  const sealedReturn: CourierMemoryRecord = {
    completedDeliveryIds: ['blue-packet'],
    packetOutcome: 'sealed',
    returnedToIo: true,
  }

  const openedReturn: CourierMemoryRecord = {
    completedDeliveryIds: ['blue-packet'],
    packetOutcome: 'opened',
    returnedToIo: true,
  }

  assertTwoRoundOfferDiverges(evaluateTwoRoundOfferDivergence(firstRun, sealedReturn))
  assertTwoRoundOfferDiverges(evaluateTwoRoundOfferDivergence(firstRun, openedReturn))
}
