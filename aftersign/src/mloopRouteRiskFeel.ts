export type RouteRiskChoiceId = "lit-stair" | "dark-cut" | "wait-bell";

export interface RouteRiskMemoryRecord {
  readonly completedRounds: number;
  readonly trustedCourier: boolean;
  readonly darkCutTakenCount: number;
  readonly waitedOutBellCount: number;
}

export interface RouteRiskAction {
  readonly id: RouteRiskChoiceId;
  readonly label: string;
  readonly risk: "safe" | "medium" | "high";
  readonly latencyBudgetMs: number;
  readonly reason: string;
}

export interface RouteRiskOffer {
  readonly round: number;
  readonly actions: readonly RouteRiskAction[];
}

const LIT_STAIR: RouteRiskAction = {
  id: "lit-stair",
  label: "Take the long lit stair",
  risk: "safe",
  latencyBudgetMs: 16,
  reason: "first-run safe route; the player always has one legible option",
};

const DARK_CUT: RouteRiskAction = {
  id: "dark-cut",
  label: "Cut through the dark service well",
  risk: "high",
  latencyBudgetMs: 16,
  reason: "trust unlocks a faster but riskier route",
};

const WAIT_BELL: RouteRiskAction = {
  id: "wait-bell",
  label: "Wait out the bell cycle",
  risk: "medium",
  latencyBudgetMs: 16,
  reason: "prior dark-route pressure unlocks a timing-safe alternative",
};

export function computeRouteRiskOffer(memory: RouteRiskMemoryRecord): RouteRiskOffer {
  const actions: RouteRiskAction[] = [LIT_STAIR];

  if (memory.trustedCourier || memory.completedRounds >= 1) {
    actions.push(DARK_CUT);
  }

  if (memory.darkCutTakenCount > memory.waitedOutBellCount) {
    actions.push(WAIT_BELL);
  }

  return {
    round: memory.completedRounds + 1,
    actions,
  };
}

export function actionIds(offer: RouteRiskOffer): readonly RouteRiskChoiceId[] {
  return offer.actions.map((action) => action.id);
}

export function checkFirstRunKeepsSingleSafeAction(): void {
  const offer = computeRouteRiskOffer({
    completedRounds: 0,
    trustedCourier: false,
    darkCutTakenCount: 0,
    waitedOutBellCount: 0,
  });

  const ids = actionIds(offer);
  if (ids.length !== 1 || ids[0] !== "lit-stair") {
    throw new Error(`first run should expose only lit-stair, got ${ids.join(",")}`);
  }
}

export function checkMemoryDivergesAvailableActions(): void {
  const firstTimer = computeRouteRiskOffer({
    completedRounds: 0,
    trustedCourier: false,
    darkCutTakenCount: 0,
    waitedOutBellCount: 0,
  });
  const trusted = computeRouteRiskOffer({
    completedRounds: 1,
    trustedCourier: true,
    darkCutTakenCount: 0,
    waitedOutBellCount: 0,
  });

  const firstTimerIds = actionIds(firstTimer);
  const trustedIds = actionIds(trusted);

  if (firstTimerIds.join("|") === trustedIds.join("|")) {
    throw new Error("different memory records must produce different tappable route actions");
  }

  if (!trustedIds.includes("dark-cut")) {
    throw new Error(`trusted route offer should include dark-cut, got ${trustedIds.join(",")}`);
  }
}

export function checkPriorRiskUnlocksWaitAction(): void {
  const offer = computeRouteRiskOffer({
    completedRounds: 2,
    trustedCourier: true,
    darkCutTakenCount: 1,
    waitedOutBellCount: 0,
  });

  const ids = actionIds(offer);
  if (!ids.includes("wait-bell")) {
    throw new Error(`prior dark-cut memory should unlock wait-bell, got ${ids.join(",")}`);
  }
}

export function checkRouteRiskLatencyBudgets(): void {
  const offer = computeRouteRiskOffer({
    completedRounds: 3,
    trustedCourier: true,
    darkCutTakenCount: 2,
    waitedOutBellCount: 0,
  });

  const slow = offer.actions.find((action) => action.latencyBudgetMs > 16);
  if (slow) {
    throw new Error(`${slow.id} exceeds one-frame input-to-feedback budget`);
  }
}

export function runRouteRiskFeelChecks(): void {
  checkFirstRunKeepsSingleSafeAction();
  checkMemoryDivergesAvailableActions();
  checkPriorRiskUnlocksWaitAction();
  checkRouteRiskLatencyBudgets();
}
