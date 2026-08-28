export type AftersignPacketOutcome = "delivered_sealed" | "opened" | "withheld" | "returned";

export interface AftersignLoopMemory {
  packetOutcome?: AftersignPacketOutcome | null;
}

export interface AftersignLoopAction {
  id: string;
  label: string;
  ioLine: string;
}

export interface AftersignLoopCopy {
  posture: "first_run" | "trusted" | "distrusted";
  offerLine: string;
  actions: AftersignLoopAction[];
}

const FIRST_RUN_COPY: AftersignLoopCopy = {
  posture: "first_run",
  offerLine: "One safe job. One blue seal. Bring both back intact.",
  actions: [
    {
      id: "blue-seal-safe-job",
      label: "Carry the blue packet",
      ioLine: "Short stair. Lit marks. If a sign whispers your name, keep walking.",
    },
  ],
};

const TRUSTED_COPY: AftersignLoopCopy = {
  posture: "trusted",
  offerLine: "You kept the seal once. I can risk giving you a stranger door.",
  actions: [
    {
      id: "pharmacy-receipt-risk-job",
      label: "Carry the pharmacy receipt",
      ioLine: "Saint Orra will fuss. Let her. Bring me what she charges, not what she says.",
    },
    {
      id: "blue-seal-repeat-job",
      label: "Carry another sealed packet",
      ioLine: "Same rule as before. The city respects a habit before it respects a name.",
    },
  ],
};

const DISTRUSTED_COPY: AftersignLoopCopy = {
  posture: "distrusted",
  offerLine: "The seal opened. So the work narrows.",
  actions: [
    {
      id: "torn-receipt-return-job",
      label: "Return the torn receipt",
      ioLine: "No sealed work tonight. Take back what is already damaged.",
    },
  ],
};

export function getAftersignLoopCopy(memory: AftersignLoopMemory = {}): AftersignLoopCopy {
  if (memory.packetOutcome === "delivered_sealed") {
    return TRUSTED_COPY;
  }

  if (memory.packetOutcome === "opened") {
    return DISTRUSTED_COPY;
  }

  return FIRST_RUN_COPY;
}

export const aftersignLoopCopy = {
  firstRun: FIRST_RUN_COPY,
  trusted: TRUSTED_COPY,
  distrusted: DISTRUSTED_COPY,
} as const;
