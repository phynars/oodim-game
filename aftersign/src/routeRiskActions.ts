export type TrustPosture = 'new' | 'trusted' | 'strained';
export type PacketOutcome = 'none' | 'delivered-sealed' | 'opened' | 'withheld' | 'returned';
export type RouteId = 'lit-stair' | 'dark-cut' | 'bell-wait';
export type JobId = 'blue-seal' | 'orra-name' | 'bell-debt';

export interface PlayerMemoryRecord {
  trustPosture: TrustPosture;
  completedDeliveries: string[];
  lastPacketOutcome: PacketOutcome;
  riskTakenCount: number;
  debtsOwed: number;
}

export interface TappableRouteAction {
  id: RouteId;
  label: string;
  risk: 'safe' | 'risky' | 'patient';
  msToReadableCommit: number;
  reason: string;
}

export interface TappableJobOffer {
  id: JobId;
  label: string;
  routeActions: TappableRouteAction[];
  reason: string;
}

export const ROUTE_COMMIT_BUDGET_MS = 160;

const SAFE_STAIR: TappableRouteAction = {
  id: 'lit-stair',
  label: 'Take the long lit stair',
  risk: 'safe',
  msToReadableCommit: 96,
  reason: 'A first-time courier needs a low-risk route they can commit to in under ten frames.',
};

const DARK_CUT: TappableRouteAction = {
  id: 'dark-cut',
  label: 'Cut through the dark landing',
  risk: 'risky',
  msToReadableCommit: 112,
  reason: 'Trust unlocks a shorter route with visible risk instead of only different dialogue.',
};

const BELL_WAIT: TappableRouteAction = {
  id: 'bell-wait',
  label: 'Wait out the bell and cross after',
  risk: 'patient',
  msToReadableCommit: 128,
  reason: 'A prior opened packet adds a cautious action that changes the next playable route.',
};

export function selectTappableJobOffers(memory: PlayerMemoryRecord): TappableJobOffer[] {
  const hasCompletedFirstPacket = memory.completedDeliveries.includes('blue-seal');

  if (!hasCompletedFirstPacket) {
    return [
      {
        id: 'blue-seal',
        label: 'Carry Io\'s blue-sealed packet',
        routeActions: [SAFE_STAIR],
        reason: 'New players get one safe job and one clearly tappable route.',
      },
    ];
  }

  if (memory.trustPosture === 'trusted' && memory.lastPacketOutcome === 'delivered-sealed') {
    return [
      {
        id: 'orra-name',
        label: 'Carry Orra\'s name before the tide turns',
        routeActions: [SAFE_STAIR, DARK_CUT],
        reason: 'A sealed delivery pays back mechanically by adding a risky route action.',
      },
      {
        id: 'bell-debt',
        label: 'Settle a bell debt for Io',
        routeActions: [DARK_CUT],
        reason: 'Trusted couriers see a second available job, not just warmer recognition copy.',
      },
    ];
  }

  if (memory.trustPosture === 'strained' || memory.lastPacketOutcome === 'opened') {
    return [
      {
        id: 'orra-name',
        label: 'Carry Orra\'s name under watch',
        routeActions: [SAFE_STAIR, BELL_WAIT],
        reason: 'An opened packet keeps the route playable but swaps in a cautious action.',
      },
    ];
  }

  return [
    {
      id: 'orra-name',
      label: 'Carry Orra\'s name',
      routeActions: [SAFE_STAIR],
      reason: 'Fallback memory states remain playable with a single safe route.',
    },
  ];
}

export function listAvailableActionIds(memory: PlayerMemoryRecord): string[] {
  return selectTappableJobOffers(memory).flatMap((offer) => [
    `job:${offer.id}`,
    ...offer.routeActions.map((route) => `route:${offer.id}:${route.id}`),
  ]);
}

export function checkRouteRiskActions(): void {
  const firstRun: PlayerMemoryRecord = {
    trustPosture: 'new',
    completedDeliveries: [],
    lastPacketOutcome: 'none',
    riskTakenCount: 0,
    debtsOwed: 0,
  };

  const trustedReturn: PlayerMemoryRecord = {
    trustPosture: 'trusted',
    completedDeliveries: ['blue-seal'],
    lastPacketOutcome: 'delivered-sealed',
    riskTakenCount: 0,
    debtsOwed: 0,
  };

  const strainedReturn: PlayerMemoryRecord = {
    trustPosture: 'strained',
    completedDeliveries: ['blue-seal'],
    lastPacketOutcome: 'opened',
    riskTakenCount: 1,
    debtsOwed: 1,
  };

  const firstActions = listAvailableActionIds(firstRun);
  const trustedActions = listAvailableActionIds(trustedReturn);
  const strainedActions = listAvailableActionIds(strainedReturn);

  if (firstActions.length !== 2) {
    throw new Error(`first run should expose one job and one route; got ${firstActions.join(', ')}`);
  }

  if (!trustedActions.includes('route:orra-name:dark-cut')) {
    throw new Error(`trusted sealed memory must unlock the risky dark-cut route; got ${trustedActions.join(', ')}`);
  }

  if (strainedActions.includes('route:orra-name:dark-cut')) {
    throw new Error(`strained/opened memory must not expose the trusted dark-cut route; got ${strainedActions.join(', ')}`);
  }

  if (!strainedActions.includes('route:orra-name:bell-wait')) {
    throw new Error(`strained/opened memory must expose the bell-wait route; got ${strainedActions.join(', ')}`);
  }

  if (trustedActions.join('|') === strainedActions.join('|')) {
    throw new Error('divergent memories must produce different tappable action ids');
  }

  for (const offer of [...selectTappableJobOffers(firstRun), ...selectTappableJobOffers(trustedReturn), ...selectTappableJobOffers(strainedReturn)]) {
    for (const route of offer.routeActions) {
      if (route.msToReadableCommit > ROUTE_COMMIT_BUDGET_MS) {
        throw new Error(`${route.id} commits in ${route.msToReadableCommit}ms, over ${ROUTE_COMMIT_BUDGET_MS}ms feel budget`);
      }
    }
  }
}

export function runRouteRiskActionChecks(): void {
  checkRouteRiskActions();
}
