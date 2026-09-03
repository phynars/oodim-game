export type MemoryRecord = {
  completedDeliveries: number;
  trustPosture: "new" | "trusted" | "debtor";
  priorRiskTaken?: "lit-stair" | "dark-cut" | "waited-bell" | "moved-through-bell";
  openedPacketDebt?: boolean;
};

export type PlayerAction = {
  id: string;
  label: string;
  kind: "job" | "price" | "route";
};

export function availableActionsForMemory(memory: MemoryRecord): PlayerAction[] {
  const actions: PlayerAction[] = [
    {
      id: "job-safe-kiosk-return",
      label: "Take Io's safe kiosk return job",
      kind: "job",
    },
  ];

  if (memory.trustPosture === "trusted" || memory.completedDeliveries >= 2) {
    actions.push({
      id: "job-sealed-packet",
      label: "Take the sealed packet across the bell stairs",
      kind: "job",
    });
  }

  if (memory.openedPacketDebt) {
    actions.push({
      id: "orra-price-debt",
      label: "Pay Orra's debt price before taking another route",
      kind: "price",
    });
  }

  if (memory.priorRiskTaken === "dark-cut") {
    actions.push({
      id: "route-dark-cut-known",
      label: "Use the short dark cut you proved last run",
      kind: "route",
    });
  }

  return actions;
}

export function actionIds(actions: PlayerAction[]): string[] {
  return actions.map((action) => action.id).sort();
}

export function memoriesProduceDifferentAvailableActions(
  first: MemoryRecord,
  second: MemoryRecord,
): boolean {
  const firstIds = actionIds(availableActionsForMemory(first));
  const secondIds = actionIds(availableActionsForMemory(second));

  if (firstIds.length !== secondIds.length) {
    return true;
  }

  return firstIds.some((id, index) => id !== secondIds[index]);
}
