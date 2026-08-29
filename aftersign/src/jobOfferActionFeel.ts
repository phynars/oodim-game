export type PacketOutcome = "sealed" | "opened" | "withheld" | "returned";
export type TrustPosture = "new" | "trusted" | "strained";

export type JobMemoryRecord = {
  completedDeliveryIds: readonly string[];
  packetOutcome?: PacketOutcome;
  trustPosture?: TrustPosture;
  openedPacketCount?: number;
  riskyRouteCount?: number;
  safeRouteCount?: number;
};

export type JobOfferAction = {
  id: "silt-stair-safe" | "moth-pier-risk" | "orra-name-debt";
  label: string;
  risk: "safe" | "risky" | "debt";
  minTouchSizePx: number;
  memoryReason: string;
};

const MIN_PHONE_TAP_TARGET_PX = 44;

const SAFE_FIRST_JOB: JobOfferAction = {
  id: "silt-stair-safe",
  label: "Take the lit stair delivery",
  risk: "safe",
  minTouchSizePx: MIN_PHONE_TAP_TARGET_PX,
  memoryReason: "first-run safe job stays available until the courier proves a memory",
};

const RISK_TRUST_JOB: JobOfferAction = {
  id: "moth-pier-risk",
  label: "Take Io's Moth Pier packet",
  risk: "risky",
  minTouchSizePx: MIN_PHONE_TAP_TARGET_PX,
  memoryReason: "sealed prior delivery makes Io trust the courier with a riskier packet",
};

const DEBT_JOB: JobOfferAction = {
  id: "orra-name-debt",
  label: "Carry Orra's name debt",
  risk: "debt",
  minTouchSizePx: MIN_PHONE_TAP_TARGET_PX,
  memoryReason: "opened prior delivery routes the courier into a debt job instead of a trust job",
};

export function getAvailableJobOfferActions(memory: JobMemoryRecord): JobOfferAction[] {
  const hasFinishedFirstDelivery = memory.completedDeliveryIds.includes("blue-packet");

  if (!hasFinishedFirstDelivery) {
    return [SAFE_FIRST_JOB];
  }

  if (memory.packetOutcome === "sealed" || memory.trustPosture === "trusted") {
    return [RISK_TRUST_JOB];
  }

  if (memory.packetOutcome === "opened" || memory.openedPacketCount) {
    return [DEBT_JOB];
  }

  return [SAFE_FIRST_JOB];
}

export function summarizeAvailableJobIds(memory: JobMemoryRecord): string[] {
  return getAvailableJobOfferActions(memory).map((action) => action.id);
}

export function checkJobOfferActionsDivergeByMemory(): void {
  const trustedSave = summarizeAvailableJobIds({
    completedDeliveryIds: ["blue-packet"],
    packetOutcome: "sealed",
    trustPosture: "trusted",
  });
  const strainedSave = summarizeAvailableJobIds({
    completedDeliveryIds: ["blue-packet"],
    packetOutcome: "opened",
    trustPosture: "strained",
    openedPacketCount: 1,
  });

  if (trustedSave.join("|") === strainedSave.join("|")) {
    throw new Error(`expected divergent job actions, got ${trustedSave.join(", ")}`);
  }

  if (!trustedSave.includes("moth-pier-risk")) {
    throw new Error(`expected trusted save to offer moth-pier-risk, got ${trustedSave.join(", ")}`);
  }

  if (!strainedSave.includes("orra-name-debt")) {
    throw new Error(`expected strained save to offer orra-name-debt, got ${strainedSave.join(", ")}`);
  }
}

export function checkJobOfferActionsStayPhoneTappable(): void {
  const allActions = [SAFE_FIRST_JOB, RISK_TRUST_JOB, DEBT_JOB];

  for (const action of allActions) {
    if (action.minTouchSizePx < MIN_PHONE_TAP_TARGET_PX) {
      throw new Error(`${action.id} tap target ${action.minTouchSizePx}px is below ${MIN_PHONE_TAP_TARGET_PX}px`);
    }
  }
}

export function runJobOfferActionFeelChecks(): void {
  checkJobOfferActionsDivergeByMemory();
  checkJobOfferActionsStayPhoneTappable();
}
