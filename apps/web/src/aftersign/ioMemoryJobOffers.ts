export type AftersignPacketOutcome = "delivered" | "opened" | "withheld" | "returned";

export type AftersignTrustPosture = "untested" | "trusted" | "watched";

export interface AftersignMemoryJobState {
  completedDeliveryIds?: readonly string[];
  packetOutcome?: AftersignPacketOutcome;
  trustPosture?: AftersignTrustPosture;
  riskTakenCount?: number;
}

export interface AftersignJobOffer {
  id: string;
  tappableActionId: string;
  title: string;
  route: string;
  risk: string;
  ioLine: string;
}

const FIRST_SAFE_JOB: AftersignJobOffer = {
  id: "blue-seal-safe-run",
  tappableActionId: "take-job-blue-seal-safe-run",
  title: "Carry the blue seal to the stair box",
  route: "Take the lit stair. Do not stop under the bell rope.",
  risk: "Low risk. Long route. Io can see most of it from the kiosk.",
  ioLine: "First run stays where the lamps can see you.",
};

const TRUSTED_DARK_CUT_JOB: AftersignJobOffer = {
  id: "orra-name-dark-cut",
  tappableActionId: "take-job-orra-name-dark-cut",
  title: "Carry Orra's name through the dark cut",
  route: "Cross behind the shuttered pharmacy before the bells count twice.",
  risk: "Short route. Unlit. Better pay because Io trusts your hands.",
  ioLine: "You brought one seal back clean. Now I can risk a name on you.",
};

const WATCHED_LEDGER_JOB: AftersignJobOffer = {
  id: "opened-seal-ledger-run",
  tappableActionId: "take-job-opened-seal-ledger-run",
  title: "Carry the torn-ledger copy by the long stair",
  route: "Stay in the amber lamps. Let every sign watch the packet.",
  risk: "Low route risk. Low trust. Io keeps the job visible.",
  ioLine: "The last seal came back knowing more than it should. This one travels in public.",
};

export function chooseIoJobOffers(memory: AftersignMemoryJobState): readonly AftersignJobOffer[] {
  const completed = new Set(memory.completedDeliveryIds ?? []);

  if (!completed.has(FIRST_SAFE_JOB.id)) {
    return [FIRST_SAFE_JOB];
  }

  if (memory.packetOutcome === "delivered" || memory.trustPosture === "trusted") {
    return [TRUSTED_DARK_CUT_JOB, FIRST_SAFE_JOB];
  }

  if (memory.packetOutcome === "opened" || memory.trustPosture === "watched") {
    return [WATCHED_LEDGER_JOB];
  }

  return [FIRST_SAFE_JOB];
}
