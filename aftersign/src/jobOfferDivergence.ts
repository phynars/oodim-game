export type PacketOutcome = 'delivered' | 'opened' | 'withheld' | 'returned'
export type TrustPosture = 'new' | 'trusted' | 'strained'

export type AftersignMemoryRecord = {
  completedDeliveryIds?: readonly string[]
  packetOutcome?: PacketOutcome
  trustPosture?: TrustPosture
  riskTakenCount?: number
  debts?: number
}

export type JobOffer = {
  id: string
  label: string
  route: 'lit-stair' | 'dark-cut' | 'bell-wait'
  risk: 'safe' | 'risky' | 'debt'
  enabled: boolean
}

const FIRST_SAFE_JOB: JobOffer = {
  id: 'blue-seal-safe-return',
  label: 'Carry the blue seal by the lit stair',
  route: 'lit-stair',
  risk: 'safe',
  enabled: true,
}

const TRUSTED_RISK_JOB: JobOffer = {
  id: 'orra-name-dark-cut',
  label: "Take Orra's name through the dark cut",
  route: 'dark-cut',
  risk: 'risky',
  enabled: true,
}

const DEBT_REPAIR_JOB: JobOffer = {
  id: 'seal-debt-bell-wait',
  label: 'Wait out the bell and repair the broken seal debt',
  route: 'bell-wait',
  risk: 'debt',
  enabled: true,
}

export function computeAvailableJobOffers(memory: AftersignMemoryRecord): readonly JobOffer[] {
  const completed = new Set(memory.completedDeliveryIds ?? [])
  const offers: JobOffer[] = []

  if (!completed.has(FIRST_SAFE_JOB.id)) {
    offers.push(FIRST_SAFE_JOB)
  }

  if (memory.trustPosture === 'trusted' || memory.packetOutcome === 'delivered') {
    offers.push(TRUSTED_RISK_JOB)
  }

  if ((memory.debts ?? 0) > 0 || memory.packetOutcome === 'opened' || memory.trustPosture === 'strained') {
    offers.push(DEBT_REPAIR_JOB)
  }

  if (offers.length === 0) {
    offers.push(FIRST_SAFE_JOB)
  }

  return offers
}

export function getTappableJobActionIds(memory: AftersignMemoryRecord): readonly string[] {
  return computeAvailableJobOffers(memory)
    .filter((offer) => offer.enabled)
    .map((offer) => `job-action-${offer.id}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(values: readonly string[], expected: string, message: string) {
  assert(values.includes(expected), `${message}: expected ${expected} in ${values.join(', ')}`)
}

function assertExcludes(values: readonly string[], unexpected: string, message: string) {
  assert(!values.includes(unexpected), `${message}: did not expect ${unexpected} in ${values.join(', ')}`)
}

export function checkFirstTimePlayerGetsOnlySafeStarterJob() {
  const actions = getTappableJobActionIds({})

  assert(actions.length === 1, `first-time player should get exactly one starter action, got ${actions.length}`)
  assertIncludes(actions, 'job-action-blue-seal-safe-return', 'first-time player needs a safe tappable job')
}

export function checkTrustedAndStrainedSavesDivergeMechanically() {
  const trustedActions = getTappableJobActionIds({
    completedDeliveryIds: ['blue-seal-safe-return'],
    packetOutcome: 'delivered',
    trustPosture: 'trusted',
    debts: 0,
  })

  const strainedActions = getTappableJobActionIds({
    completedDeliveryIds: ['blue-seal-safe-return'],
    packetOutcome: 'opened',
    trustPosture: 'strained',
    debts: 1,
  })

  assertIncludes(trustedActions, 'job-action-orra-name-dark-cut', 'trusted save should unlock the risky Orra job')
  assertExcludes(trustedActions, 'job-action-seal-debt-bell-wait', 'trusted clean save should not show debt repair')
  assertIncludes(strainedActions, 'job-action-seal-debt-bell-wait', 'strained save should expose debt repair as a tappable action')
  assertExcludes(strainedActions, 'job-action-orra-name-dark-cut', 'strained save should not get the trusted risky job')
}

export function runJobOfferDivergenceChecks() {
  checkFirstTimePlayerGetsOnlySafeStarterJob()
  checkTrustedAndStrainedSavesDivergeMechanically()
}
