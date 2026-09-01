export type PacketOutcome = 'delivered' | 'opened' | 'withheld' | 'returned';

export type RouteRisk = 'safe' | 'risky' | 'unknown';

export interface AftersignMemoryRecord {
  completedDeliveryIds: readonly string[];
  packetOutcome?: PacketOutcome;
  ioTrustPosture: 'unknown' | 'trusted' | 'strained';
  riskHistory: readonly RouteRisk[];
}

export interface JobOffer {
  id: string;
  label: string;
  route: 'lit-stair' | 'dark-cut' | 'bell-wait';
  risk: 'low' | 'medium' | 'high';
  tappableActionId: string;
}

const FIRST_SAFE_JOB: JobOffer = {
  id: 'blue-packet-safe',
  label: 'Carry the sealed blue packet by the lit stair.',
  route: 'lit-stair',
  risk: 'low',
  tappableActionId: 'job-offer-blue-packet-safe',
};

const TRUSTED_DARK_CUT_JOB: JobOffer = {
  id: 'orra-name-dark-cut',
  label: 'Carry Orra\'s name through the short dark cut.',
  route: 'dark-cut',
  risk: 'high',
  tappableActionId: 'job-offer-orra-name-dark-cut',
};

const STRAINED_BELL_WAIT_JOB: JobOffer = {
  id: 'ledger-bell-wait',
  label: 'Wait out the bell and carry the ledger copy.',
  route: 'bell-wait',
  risk: 'medium',
  tappableActionId: 'job-offer-ledger-bell-wait',
};

export function computeMloopJobOffers(memory: AftersignMemoryRecord): JobOffer[] {
  const completedFirstDelivery = memory.completedDeliveryIds.includes('blue-packet');

  if (!completedFirstDelivery) {
    return [FIRST_SAFE_JOB];
  }

  if (memory.ioTrustPosture === 'trusted' && memory.packetOutcome === 'delivered') {
    return [TRUSTED_DARK_CUT_JOB, FIRST_SAFE_JOB];
  }

  if (memory.ioTrustPosture === 'strained' || memory.packetOutcome === 'opened') {
    return [STRAINED_BELL_WAIT_JOB];
  }

  return [FIRST_SAFE_JOB];
}

export function getMloopTappableActionIds(memory: AftersignMemoryRecord): string[] {
  return computeMloopJobOffers(memory).map((offer) => offer.tappableActionId);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDifferentActions(left: readonly string[], right: readonly string[], message: string): void {
  assert(left.length !== right.length || left.some((actionId, index) => actionId !== right[index]), message);
}

export function checkMloopFirstTimerGetsOnlySafeJob(): void {
  const actions = getMloopTappableActionIds({
    completedDeliveryIds: [],
    ioTrustPosture: 'unknown',
    riskHistory: [],
  });

  assert(actions.length === 1, 'first-time players should see one job offer');
  assert(actions[0] === 'job-offer-blue-packet-safe', 'first-time job should be the safe blue-packet offer');
}

export function checkMloopTrustedAndStrainedSavesDiverge(): void {
  const trustedActions = getMloopTappableActionIds({
    completedDeliveryIds: ['blue-packet'],
    packetOutcome: 'delivered',
    ioTrustPosture: 'trusted',
    riskHistory: ['safe'],
  });

  const strainedActions = getMloopTappableActionIds({
    completedDeliveryIds: ['blue-packet'],
    packetOutcome: 'opened',
    ioTrustPosture: 'strained',
    riskHistory: ['risky'],
  });

  assert(trustedActions.includes('job-offer-orra-name-dark-cut'), 'trusted save should expose the risky dark-cut job');
  assert(strainedActions.includes('job-offer-ledger-bell-wait'), 'strained save should expose the bell-wait job');
  assertDifferentActions(trustedActions, strainedActions, 'different memory records must produce different tappable actions');
}

export function runMloopJobChecks(): void {
  checkMloopFirstTimerGetsOnlySafeJob();
  checkMloopTrustedAndStrainedSavesDiverge();
}
